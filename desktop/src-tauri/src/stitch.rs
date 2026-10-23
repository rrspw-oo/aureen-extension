//! Stitches a sequence of same-sized window screenshots, taken while the page scrolled down,
//! into one tall image. Pure image logic (no macOS APIs) so it is unit-tested on any platform.

use image::{GenericImage, GenericImageView, RgbaImage};

/// Rows that look the same in two frames: a quantised luminance sample of each row.
fn row_signatures(img: &RgbaImage) -> Vec<(u64, bool)> {
    let (w, h) = img.dimensions();
    let samples = 96.min(w).max(1);
    (0..h)
        .map(|y| {
            let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
            let mut first = None;
            let mut uniform = true;
            for i in 0..samples {
                let x = (i as u64 * (w as u64 - 1) / (samples as u64).max(1)) as u32;
                let p = img.get_pixel(x, y).0;
                let lum = ((p[0] as u32 * 3 + p[1] as u32 * 6 + p[2] as u32) / 10 >> 2) as u8;
                match first {
                    None => first = Some(lum),
                    Some(f) if f != lum => uniform = false,
                    _ => {}
                }
                hash = (hash ^ lum as u64).wrapping_mul(0x0100_0000_01b3);
            }
            (hash, uniform)
        })
        .collect()
}

/// Rows shared by both frames at the top and bottom (toolbars, sticky headers, status bars).
fn static_bands(a: &[(u64, bool)], b: &[(u64, bool)]) -> (usize, usize) {
    let h = a.len();
    let limit = h * 2 / 5;
    let top = a
        .iter()
        .zip(b)
        .take(limit)
        .take_while(|(x, y)| x.0 == y.0)
        .count();
    let bottom = a
        .iter()
        .rev()
        .zip(b.iter().rev())
        .take(limit)
        .take_while(|(x, y)| x.0 == y.0)
        .count();
    (top, bottom)
}

/// How far the content moved between `a` and `b` inside the scrolling band `[top, top + m)`.
/// Returns `None` when no shift explains the frames (then the band is appended whole).
fn find_shift(a: &[(u64, bool)], b: &[(u64, bool)], top: usize, m: usize) -> Option<usize> {
    let mut best: Option<(usize, f64, usize)> = None;
    for s in 1..m {
        let overlap = m - s;
        let mut informative = 0usize;
        let mut matched = 0usize;
        for i in 0..overlap {
            let ra = a[top + s + i];
            let rb = b[top + i];
            if ra.1 && rb.1 {
                continue;
            }
            informative += 1;
            if ra.0 == rb.0 {
                matched += 1;
            }
        }
        if informative < 8 {
            continue;
        }
        let ratio = matched as f64 / informative as f64;
        if ratio < 0.92 {
            continue;
        }
        let better = match best {
            None => true,
            Some((_, r, inf)) => {
                ratio > r + 1e-9 || ((ratio - r).abs() < 1e-9 && informative > inf)
            }
        };
        if better {
            best = Some((s, ratio, informative));
        }
    }
    best.map(|(s, _, _)| s)
}

/// Height of the fixed toolbar / footer of a window, learned from two scrolled frames.
pub fn fixed_bands(a: &RgbaImage, b: &RgbaImage) -> (usize, usize) {
    if a.dimensions() != b.dimensions() {
        return (0, 0);
    }
    static_bands(&row_signatures(a), &row_signatures(b))
}

/// True when `next` shows content at or a little below `prev` (within one screen).
/// Used for "capture to here": scrolling stops once the user's chosen view is in reach.
/// `bands` are the window's fixed toolbar/footer heights, ignored in the comparison: the
/// chosen view may have been taken while the window looked different (e.g. inactive).
pub fn continues_into(prev: &RgbaImage, next: &RgbaImage, bands: (usize, usize)) -> bool {
    if prev.dimensions() != next.dimensions() {
        return false;
    }
    let (a, b) = (row_signatures(prev), row_signatures(next));
    let (st, sb) = static_bands(&a, &b);
    let (top, bottom) = (st.max(bands.0), sb.max(bands.1));
    let m = a.len().saturating_sub(top + bottom);
    if m == 0 {
        return false;
    }
    if a[top..top + m] == b[top..top + m] {
        return true; // same view
    }
    find_shift(&a, &b, top, m).is_some()
}

pub fn frames_identical(a: &RgbaImage, b: &RgbaImage) -> bool {
    a.dimensions() == b.dimensions() && a.as_raw() == b.as_raw()
}

/// Joins the frames top to bottom, keeping a fixed header/footer only once.
pub fn stitch(frames: &[RgbaImage]) -> Option<RgbaImage> {
    let first = frames.first()?;
    let (w, h) = first.dimensions();
    let frames: Vec<&RgbaImage> = frames.iter().filter(|f| f.dimensions() == (w, h)).collect();
    let sigs: Vec<Vec<(u64, bool)>> = frames.iter().map(|f| row_signatures(f)).collect();

    // (frame index, first row, row count) slices to copy, in order.
    let mut pieces: Vec<(usize, u32, u32)> = Vec::new();
    let mut last_bottom = 0usize;
    if frames.len() == 1 {
        return Some(first.clone());
    }
    for i in 1..frames.len() {
        if sigs[i - 1] == sigs[i] {
            continue; // nothing scrolled
        }
        let (top, bottom) = static_bands(&sigs[i - 1], &sigs[i]);
        let m = (h as usize).saturating_sub(top + bottom);
        if m == 0 {
            continue;
        }
        if pieces.is_empty() {
            // First frame: everything except the static footer.
            pieces.push((0, 0, (h as usize - bottom) as u32));
        }
        let new_rows = find_shift(&sigs[i - 1], &sigs[i], top, m).unwrap_or(m);
        let start = top + m - new_rows;
        pieces.push((i, start as u32, new_rows as u32));
        last_bottom = bottom;
    }
    if pieces.is_empty() {
        return Some(first.clone());
    }
    let last = pieces.last().map(|p| p.0).unwrap_or(0);
    if last_bottom > 0 {
        pieces.push((last, h - last_bottom as u32, last_bottom as u32));
    }

    let total: u32 = pieces.iter().map(|p| p.2).sum();
    let mut out = RgbaImage::new(w, total);
    let mut y = 0;
    for (idx, start, rows) in pieces {
        if rows == 0 {
            continue;
        }
        let view = frames[idx].view(0, start, w, rows);
        out.copy_from(&*view, 0, y).ok()?;
        y += rows;
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    /// A tall "page" with varied rows, viewed through a window with a fixed toolbar and footer.
    fn page(height: u32, width: u32) -> RgbaImage {
        RgbaImage::from_fn(width, height, |x, y| {
            let band = (y / 7) % 13;
            if band == 0 {
                Rgba([255, 255, 255, 255]) // blank spacer rows
            } else {
                Rgba([
                    ((x * 3 + y * 7) % 251) as u8,
                    ((y * 13) % 241) as u8,
                    ((x + y) % 239) as u8,
                    255,
                ])
            }
        })
    }

    fn window(page: &RgbaImage, scroll: u32, view_h: u32, header: u32, footer: u32) -> RgbaImage {
        let w = page.width();
        let mut img = RgbaImage::new(w, header + view_h + footer);
        for y in 0..header {
            for x in 0..w {
                img.put_pixel(x, y, Rgba([40, 90, (x % 200) as u8, 255]));
            }
        }
        img.copy_from(&*page.view(0, scroll, w, view_h), 0, header)
            .unwrap();
        for y in 0..footer {
            for x in 0..w {
                img.put_pixel(
                    x,
                    header + view_h + y,
                    Rgba([200, (x % 120) as u8, 30, 255]),
                );
            }
        }
        img
    }

    #[test]
    fn stitches_scrolled_frames_back_into_the_page() {
        let (w, view_h, header, footer) = (160, 300, 40, 20);
        let p = page(1000, w);
        // Page Down style steps with overlap, last step clamped at the end of the page.
        let scrolls = [0, 260, 520, 700];
        let frames: Vec<RgbaImage> = scrolls
            .iter()
            .map(|&s| window(&p, s, view_h, header, footer))
            .collect();
        let out = stitch(&frames).unwrap();

        assert_eq!(out.height(), header + 1000 + footer);
        let expected = {
            let mut e = RgbaImage::new(w, header + 1000 + footer);
            e.copy_from(&*frames[0].view(0, 0, w, header), 0, 0)
                .unwrap();
            e.copy_from(&p, 0, header).unwrap();
            e.copy_from(
                &*frames[0].view(0, header + view_h, w, footer),
                0,
                header + 1000,
            )
            .unwrap();
            e
        };
        assert!(
            out.as_raw() == expected.as_raw(),
            "stitched image differs from the page"
        );
    }

    #[test]
    fn encodes_a_jpeg_data_url() {
        let p = page(400, 120);
        let frames = vec![window(&p, 0, 200, 10, 0), window(&p, 150, 200, 10, 0)];
        let url = to_jpeg_data_url(&frames).unwrap();
        assert!(url.starts_with("data:image/jpeg;base64,"));
    }

    #[test]
    fn detects_when_the_chosen_end_view_is_within_reach() {
        let p = page(1400, 160);
        let at = |s| window(&p, s, 300, 40, 20);
        let bands = fixed_bands(&at(0), &at(260));
        assert_eq!(bands, (40, 20));
        assert!(continues_into(&at(0), &at(200), bands));
        assert!(continues_into(&at(0), &at(0), bands));
        assert!(!continues_into(&at(0), &at(700), bands));
    }

    #[test]
    fn end_view_taken_while_the_window_was_inactive_still_matches() {
        // The chosen view is captured while Aureen's bar has focus: the window's toolbar is
        // greyed out, so its header rows differ from the frames taken while scrolling.
        let p = page(1400, 160);
        let at = |s| window(&p, s, 300, 40, 20);
        let mut end = at(500);
        for y in 0..40 {
            for x in 0..160 {
                end.put_pixel(x, y, Rgba([120, 120, 120, 255]));
            }
        }
        let bands = fixed_bands(&at(0), &at(260));
        assert!(continues_into(&at(260), &end, bands));
        assert!(!continues_into(&at(0), &end, bands));
    }

    #[test]
    fn single_frame_is_returned_as_is() {
        let p = page(300, 80);
        let f = window(&p, 0, 200, 10, 0);
        assert_eq!(stitch(&[f.clone()]).unwrap().as_raw(), f.as_raw());
    }

    #[test]
    fn identical_frames_add_nothing() {
        let p = page(300, 80);
        let f = window(&p, 0, 200, 10, 5);
        let out = stitch(&[f.clone(), f.clone()]).unwrap();
        assert_eq!(out.height(), f.height());
    }
}

/// Stitches, keeps the result within WebKit's canvas limits (so it can still be trimmed),
/// and returns it as a JPEG data URL.
pub fn to_jpeg_data_url(frames: &[RgbaImage]) -> Result<String, String> {
    use base64::Engine;
    const MAX_HEIGHT: u32 = 30_000;

    let stitched = stitch(frames).ok_or_else(|| "沒有截到畫面".to_string())?;
    let mut img = image::DynamicImage::ImageRgba8(stitched);
    // Retina frames are twice the needed width; keep text sharp but the file light.
    const MAX_WIDTH: u32 = 2000;
    if img.width() > MAX_WIDTH {
        let height = ((img.height() as u64 * MAX_WIDTH as u64) / img.width() as u64).max(1) as u32;
        img = img.thumbnail_exact(MAX_WIDTH, height);
    }
    if img.height() > MAX_HEIGHT {
        let width = ((img.width() as u64 * MAX_HEIGHT as u64) / img.height() as u64).max(1) as u32;
        img = img.thumbnail_exact(width, MAX_HEIGHT);
    }
    let rgb = img.to_rgb8();
    let mut buf: Vec<u8> = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 92)
        .encode_image(&rgb)
        .map_err(|e| e.to_string())?;
    Ok(format!(
        "data:image/jpeg;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(buf)
    ))
}
