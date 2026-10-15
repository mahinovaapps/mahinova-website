# Mahinova

Website for Mahinova, a software and mobile app development studio in India. *Ideas built into apps.*

## Website

A static site with no build step:

- Pages: `index.html` (Home), `services.html`, `work.html`, `about.html`, `contact.html`, `404.html`
- `styles.css` for all styling, `main.js` for the mobile menu and the contact form
- `assets/` for the logo, icon and link preview image, plus `robots.txt` and `sitemap.xml`

The header and footer are repeated in each page, so change them in every file. The contact form has no server: it opens WhatsApp or email with the visitor's details filled in.

Preview locally:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

The site will live at https://mahinova.in. It can be hosted as-is on GitHub Pages, Netlify, Vercel, or any static host.

## Brand

| Token | Value |
| --- | --- |
| Deep Purple | `#1E1038` |
| Nova Purple | `#6D3FE0` |
| Nova Gold | `#FFB703` |
| Lilac Mist | `#F5F1FC` |
| Plum Slate | `#4A3F66` |

Headings use Sora, body text uses Manrope (Google Fonts).
