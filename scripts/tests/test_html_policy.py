import unittest

from scripts.book_import.html_policy import HTMLPolicyError, validate_html_policy


class HTMLPolicyTest(unittest.TestCase):
    def test_allowed_html_passes_validation(self):
        valid = (
            '<div class="mm-release-marker" data-mm-release="abc" data-mm-topic="t-1" hidden></div>'
            '<p class="mm-para" data-mm-source-path="p[1]">'
            '<strong>Hello</strong> <span class="mm-tab" aria-hidden="true">&#9;</span>'
            '<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="mm-link">link</a>'
            '</p>'
            '<div class="mm-table-scroll" role="region" tabindex="0" aria-label="Table">'
            '<table class="mm-table"><tbody><tr><td>cell</td></tr></tbody></table>'
            '</div>'
            '<figure class="mm-figure" data-mm-figure-id="fig-1">'
            '<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="#FFFFFF"/></svg>'
            '</figure>'
        )
        validate_html_policy(valid, "t-1")

    def test_script_tag_is_rejected(self):
        with self.assertRaises(HTMLPolicyError) as ctx:
            validate_html_policy('<p>Hi</p><script>alert(1)</script>', "t-1")
        self.assertIn("Forbidden HTML tag", str(ctx.exception))

    def test_javascript_scheme_is_rejected(self):
        with self.assertRaises(HTMLPolicyError) as ctx:
            validate_html_policy('<a href="javascript:alert(1)">Click</a>', "t-1")
        self.assertIn("javascript", str(ctx.exception))

    def test_event_handler_is_rejected(self):
        with self.assertRaises(HTMLPolicyError) as ctx:
            validate_html_policy('<p onclick="doBadThing()">Test</p>', "t-1")
        self.assertIn("Inline event handler", str(ctx.exception))

    def test_css_expression_is_rejected(self):
        with self.assertRaises(HTMLPolicyError) as ctx:
            validate_html_policy('<p style="color: expression(alert(1))">Test</p>', "t-1")
        self.assertIn("expression", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
