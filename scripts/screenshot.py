#!/usr/bin/env python3
"""
UI/UX Review Screenshot Tool

Supports both authenticated and unauthenticated screenshots.
Uses Playwright with Storage State for session persistence.

Usage:
    python scripts/screenshot.py [OPTIONS] [pages...]

Options:
    --auth-setup    Interactive login to save authentication state
    --auth          Use saved authentication state for screenshots
    --base-url URL  Base URL (default: https://localhost:4321 with --auth, http://localhost:4321 without)

Examples:
    python scripts/screenshot.py                          # Unauthenticated (HTTP)
    python scripts/screenshot.py --auth-setup             # Setup authentication
    python scripts/screenshot.py --auth                   # Authenticated (all auth pages)
    python scripts/screenshot.py --auth /bonsai/new       # Authenticated (specific page)
    python scripts/screenshot.py /                        # Top page only (HTTP)
"""

import argparse
import os
import stat
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

# Default configuration
DEFAULT_BASE_URL_HTTP = "http://localhost:4321"
DEFAULT_BASE_URL_HTTPS = "https://localhost:4321"
OUTPUT_DIR = tempfile.gettempdir()
AUTH_STATE_FILE = ".screenshot-auth.json"

# Hosts that are allowed to use ignore_https_errors
TRUSTED_HOSTS = {"localhost", "127.0.0.1", "::1"}

# Default pages for unauthenticated mode
DEFAULT_PAGES = [
    ("/", "page-top.png"),
    ("/bonsai", "page-bonsai.png"),
]

# Default pages for authenticated mode (requires login)
DEFAULT_AUTH_PAGES = [
    ("/bonsai/new", "page-bonsai-new.png"),
    ("/bonsai/quick-add", "page-bonsai-quick-add.png"),
]


def get_script_dir() -> Path:
    """Get the directory where the script is located."""
    return Path(__file__).parent.parent.resolve()


def get_auth_state_path() -> Path:
    """Get the path to the authentication state file."""
    return get_script_dir() / AUTH_STATE_FILE


def take_screenshot(page, base_url: str, path: str, output_name: str) -> str:
    """Take a screenshot of the given page."""
    url = f"{base_url}{path}"
    output_path = f"{OUTPUT_DIR}/{output_name}"

    page.goto(url)
    page.wait_for_load_state("networkidle")

    # Check if redirected to login page (session expired or not authenticated)
    if "/login" in page.url:
        print(f"  Warning: Redirected to login page. Session may have expired.")
        print(f"  Run with --auth-setup to re-authenticate.")

    page.screenshot(path=output_path, full_page=True)

    return output_path


def is_trusted_host(base_url: str) -> bool:
    """Check if the base URL host is in the trusted hosts list."""
    parsed = urlparse(base_url)
    return parsed.hostname in TRUSTED_HOSTS


def auth_setup(base_url: str) -> None:
    """Interactive login to save authentication state."""
    auth_state_path = get_auth_state_path()

    print("Starting authentication setup...")
    print(f"Base URL: {base_url}")
    print(f"Auth state will be saved to: {auth_state_path}")
    print()

    # Only ignore HTTPS errors for trusted hosts (localhost, etc.)
    ignore_https = is_trusted_host(base_url)
    if ignore_https:
        print("Note: HTTPS certificate verification disabled for trusted local host.")
    else:
        print("Warning: Using strict HTTPS verification for non-local host.")
    print()

    browser = None
    try:
        with sync_playwright() as p:
            # Launch browser in headed mode for interactive login
            browser = p.chromium.launch(headless=False)
            context = browser.new_context(
                viewport={"width": 1280, "height": 900},
                ignore_https_errors=ignore_https,
            )
            page = context.new_page()

            # Navigate to login page
            login_url = f"{base_url}/login"
            print(f"Opening: {login_url}")

            try:
                page.goto(login_url)
            except Exception as e:
                print(f"Error: Failed to connect to {login_url}")
                print(f"  {e}")
                print()
                print("Please ensure the development server is running:")
                print("  pnpm dev")
                sys.exit(1)

            print()
            print("=" * 60)
            print("Please log in using GitHub or Google in the browser window.")
            print("After successful login, you will be redirected to the home page.")
            print("The browser will close automatically when authentication is complete.")
            print("=" * 60)
            print()

            # Wait for successful login (redirected away from login page)
            # Use polling instead of lambda (Playwright Python doesn't support functions)
            start_time = page.evaluate("Date.now()")
            timeout_ms = 300000  # 5 minutes
            while True:
                current_url = page.url
                if "/login" not in current_url and "callback" not in current_url:
                    break
                elapsed = page.evaluate("Date.now()") - start_time
                if elapsed > timeout_ms:
                    raise TimeoutError("Login timed out after 5 minutes")
                page.wait_for_timeout(500)

            # Give a moment for cookies to be set
            page.wait_for_timeout(2000)

            # Save storage state
            context.storage_state(path=str(auth_state_path))

            # Set restrictive permissions (owner read/write only)
            try:
                os.chmod(auth_state_path, stat.S_IRUSR | stat.S_IWUSR)
            except OSError as e:
                print(f"Warning: Could not set file permissions: {e}")
                print("  The auth state file may be readable by others.")

            print()
            print("Authentication successful!")
            print(f"State saved to: {auth_state_path}")
            print()
            print("You can now use --auth to take authenticated screenshots.")

    except TimeoutError as e:
        print(f"Authentication timed out: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Authentication failed: {e}")
        sys.exit(1)
    finally:
        if browser:
            browser.close()


def take_screenshots(base_url: str, pages: list, use_auth: bool) -> None:
    """Take screenshots of the specified pages."""
    auth_state_path = get_auth_state_path()

    if use_auth and not auth_state_path.exists():
        print(f"Error: Auth state file not found: {auth_state_path}")
        print("Run with --auth-setup first to set up authentication.")
        sys.exit(1)

    # Only ignore HTTPS errors for trusted hosts (localhost, etc.)
    ignore_https = is_trusted_host(base_url)

    print(f"Taking screenshots (auth={'enabled' if use_auth else 'disabled'})...")
    print(f"Base URL: {base_url}")
    if ignore_https and base_url.startswith("https"):
        print("Note: HTTPS certificate verification disabled for trusted local host.")
    print()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Create context with or without authentication state
        context_options = {
            "viewport": {"width": 1280, "height": 900},
            "ignore_https_errors": ignore_https,
        }

        if use_auth:
            context_options["storage_state"] = str(auth_state_path)

        context = browser.new_context(**context_options)
        page = context.new_page()

        results = []
        for path, output_name in pages:
            try:
                output_path = take_screenshot(page, base_url, path, output_name)
                results.append(output_path)
                print(f"Screenshot saved: {output_path}")
            except Exception as e:
                print(f"Error taking screenshot for {path}: {e}")

        browser.close()

    print(f"\nTotal: {len(results)} screenshot(s) saved to {OUTPUT_DIR}/")


def main():
    parser = argparse.ArgumentParser(
        description="UI/UX Review Screenshot Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s                          # Unauthenticated (HTTP)
    %(prog)s --auth-setup             # Setup authentication
    %(prog)s --auth                   # Authenticated (all auth pages)
    %(prog)s --auth /bonsai/new       # Authenticated (specific page)
    %(prog)s /                        # Top page only (HTTP)
""",
    )

    parser.add_argument(
        "--auth-setup",
        action="store_true",
        help="Interactive login to save authentication state",
    )
    parser.add_argument(
        "--auth",
        action="store_true",
        help="Use saved authentication state for screenshots",
    )
    parser.add_argument(
        "--base-url",
        type=str,
        help=f"Base URL (default: {DEFAULT_BASE_URL_HTTPS} with --auth, {DEFAULT_BASE_URL_HTTP} without)",
    )
    parser.add_argument(
        "pages",
        nargs="*",
        help="Pages to screenshot (e.g., / /bonsai /bonsai/new)",
    )

    args = parser.parse_args()

    # Determine base URL
    if args.base_url:
        base_url = args.base_url
    elif args.auth or args.auth_setup:
        base_url = DEFAULT_BASE_URL_HTTPS
    else:
        base_url = DEFAULT_BASE_URL_HTTP

    # Handle auth setup mode
    if args.auth_setup:
        auth_setup(base_url)
        return

    # Determine which pages to screenshot
    if args.pages:
        pages = [
            (path, f"page-{path.strip('/').replace('/', '-') or 'top'}.png")
            for path in args.pages
        ]
    elif args.auth:
        pages = DEFAULT_AUTH_PAGES
    else:
        pages = DEFAULT_PAGES

    take_screenshots(base_url, pages, args.auth)


if __name__ == "__main__":
    main()
