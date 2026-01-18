#!/usr/bin/env python3
"""
UI/UX Review Screenshot Tool

Usage:
    python scripts/screenshot.py [pages...]

Examples:
    python scripts/screenshot.py                    # All default pages
    python scripts/screenshot.py /                  # Top page only
    python scripts/screenshot.py / /bonsai          # Top and bonsai list
    python scripts/screenshot.py /bonsai/quick-add  # Specific page
"""

import sys
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:4321"
OUTPUT_DIR = "/tmp"

DEFAULT_PAGES = [
    ("/", "page-top.png"),
    ("/bonsai", "page-bonsai.png"),
]


def take_screenshot(page, path: str, output_name: str) -> str:
    """Take a screenshot of the given page."""
    url = f"{BASE_URL}{path}"
    output_path = f"{OUTPUT_DIR}/{output_name}"

    page.goto(url)
    page.wait_for_load_state("networkidle")
    page.screenshot(path=output_path, full_page=True)

    return output_path


def main():
    args = sys.argv[1:]

    # Determine which pages to screenshot
    if args:
        pages = [(path, f"page-{path.strip('/').replace('/', '-') or 'top'}.png") for path in args]
    else:
        pages = DEFAULT_PAGES

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})

        results = []
        for path, output_name in pages:
            output_path = take_screenshot(page, path, output_name)
            results.append(output_path)
            print(f"Screenshot saved: {output_path}")

        browser.close()

    print(f"\nTotal: {len(results)} screenshot(s) saved to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
