import importlib
import os
import sys
import unittest
from unittest.mock import patch, mock_open

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestArgParsing(unittest.TestCase):
    def _parse(self, args):
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
        self.assertIsNone(args.ref)

    def test_missing_out_exits(self):
        with self.assertRaises(SystemExit):
            self._parse(["p.txt"])


class TestGenerate(unittest.TestCase):
    def setUp(self):
        import tools.gen_image as m
        importlib.reload(m)
        self.m = m

    def test_generate_without_ref_calls_images_generate(self):
        with patch.object(self.m.openai, "OpenAI") as mock_openai_cls, \
             patch("builtins.open", mock_open()):
            mock_client = mock_openai_cls.return_value
            mock_client.images.generate.return_value.data = [
                type("Obj", (), {"b64_json": "AAAA"})()
            ]
            self.m.generate("prompt", "1536x1024", None, "out.png")
            mock_client.images.generate.assert_called_once_with(
                model="gpt-image-2", prompt="prompt", size="1536x1024"
            )
            mock_client.images.edit.assert_not_called()

    def test_generate_with_ref_calls_images_edit(self):
        with patch.object(self.m.openai, "OpenAI") as mock_openai_cls, \
             patch("builtins.open", mock_open(read_data=b"fakeimg")):
            mock_client = mock_openai_cls.return_value
            mock_client.images.edit.return_value.data = [
                type("Obj", (), {"b64_json": "AAAA"})()
            ]
            self.m.generate("prompt", "1536x1024", "ref.png", "out.png")
            mock_client.images.edit.assert_called_once()
            _, kwargs = mock_client.images.edit.call_args
            self.assertEqual(kwargs["model"], "gpt-image-2")
            self.assertEqual(kwargs["prompt"], "prompt")
            self.assertEqual(kwargs["size"], "1536x1024")
            mock_client.images.generate.assert_not_called()


class TestOutputDir(unittest.TestCase):
    def test_output_dir_created(self):
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
