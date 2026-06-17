import argparse
import os
import sys
import unittest
from unittest.mock import MagicMock, patch, mock_open

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestArgParsing(unittest.TestCase):
    def _parse(self, args):
        import importlib
        import tools.gen_image as m
        importlib.reload(m)
        parser = m._build_parser()
        return parser.parse_args(args)

    def test_required_args(self):
        args = self._parse(["myprompt.txt", "--out", "out.png"])
        self.assertEqual(args.prompt_file, "myprompt.txt")
        self.assertEqual(args.out, "out.png")

    def test_defaults(self):
        args = self._parse(["p.txt", "--out", "o.png"])
        self.assertEqual(args.size, "1536x1024")
        self.assertEqual(args.backend, "oauth")
        self.assertIsNone(args.ref)

    def test_backend_choices(self):
        args = self._parse(["p.txt", "--out", "o.png", "--backend", "api"])
        self.assertEqual(args.backend, "api")

    def test_invalid_backend_exits(self):
        with self.assertRaises(SystemExit):
            self._parse(["p.txt", "--out", "o.png", "--backend", "bad"])

    def test_missing_out_exits(self):
        with self.assertRaises(SystemExit):
            self._parse(["p.txt"])


class TestGenerateRouting(unittest.TestCase):
    def setUp(self):
        import importlib
        import tools.gen_image as m
        importlib.reload(m)
        self.m = m

    def test_oauth_backend_called(self):
        with patch.object(self.m, "_chatgpt_oauth") as mock_oauth:
            self.m.generate("prompt", "1536x1024", None, "oauth", "out.png")
            mock_oauth.assert_called_once_with("prompt", "1536x1024", "out.png")

    def test_api_backend_called(self):
        with patch.object(self.m, "_openai_api") as mock_api:
            self.m.generate("prompt", "1536x1024", "ref.png", "api", "out.png")
            mock_api.assert_called_once_with("prompt", "1536x1024", "ref.png", "out.png")

    def test_unknown_backend_exits(self):
        with self.assertRaises(SystemExit):
            self.m.generate("prompt", "1536x1024", None, "unknown", "out.png")


class TestOutputDir(unittest.TestCase):
    def test_output_dir_created(self):
        import importlib
        import tools.gen_image as m
        importlib.reload(m)

        with patch.object(m, "generate"), \
             patch("builtins.open", mock_open(read_data="some prompt")), \
             patch("tools.gen_image.os.makedirs") as mock_makedirs:
            sys.argv = ["gen_image.py", "p.txt", "--out", "a/b/c.png"]
            try:
                m.main()
            except SystemExit:
                pass
            mock_makedirs.assert_called_with(os.path.dirname(os.path.abspath("a/b/c.png")), exist_ok=True)


if __name__ == "__main__":
    unittest.main()
