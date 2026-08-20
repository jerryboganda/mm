import argparse
import hashlib
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.book_import.compiler import compile_book
from scripts.book_import.constants import AUTHORITATIVE_SOURCE_RELATIVE_PATH, SOURCE_SHA256
from scripts.book_import.manifest import load_release_manifest
from scripts.book_import.package import OOXMLPackage


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Compile Maternal Mind authoritative DOCX into deterministic responsive content blocks."
    )
    parser.add_argument(
        "--docx",
        type=Path,
        default=Path(__file__).resolve().parents[1] / AUTHORITATIVE_SOURCE_RELATIVE_PATH,
        help="Path to the authoritative DOCX file.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("content/book-releases"),
        help="Root directory where compiled release JSON/SQL packages are written.",
    )
    parser.add_argument(
        "--media-dir",
        type=Path,
        default=Path("uploads/content-images/maternal-mind-book"),
        help="Root directory where media assets (PNG/JPEG) are materialized.",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify the existing compiled release manifest without re-compiling.",
    )

    args = parser.parse_args()
    docx_path = args.docx.resolve()
    if not docx_path.is_file():
        print(f"ERROR: DOCX file not found: {docx_path}", file=sys.stderr)
        return 1

    print(f"[*] Opening package: {docx_path.name}")
    source_digest = hashlib.sha256(docx_path.read_bytes()).hexdigest()
    print(f"[*] Source SHA-256: {source_digest}")

    if source_digest != SOURCE_SHA256:
        print(
            f"ERROR: Source digest mismatch! Expected {SOURCE_SHA256}, got {source_digest}",
            file=sys.stderr,
        )
        return 1

    package = OOXMLPackage.from_file(docx_path)
    manifest_path = args.output_dir.resolve() / source_digest / "release_manifest.json"

    if args.verify_only:
        if not manifest_path.is_file():
            print(f"ERROR: Release manifest not found: {manifest_path}", file=sys.stderr)
            return 1
        manifest = load_release_manifest(manifest_path)
        print(f"[+] Verified release manifest: {manifest.topic_count} topics, {manifest.total_block_count} blocks, {manifest.total_media_count} media assets.")
        return 0

    print(f"[*] Compiling {docx_path.name}...")
    start_time = time.time()
    result = compile_book(
        package,
        source_sha256=source_digest,
        source_filename=docx_path.name,
        output_release_dir=args.output_dir.resolve(),
        output_media_dir=args.media_dir.resolve(),
    )
    elapsed = time.time() - start_time

    print(f"[+] Compilation succeeded in {elapsed:.2f}s!")
    print(f"    - Source SHA-256: {result.source_sha256}")
    print(f"    - Books: {result.manifest.book_count}")
    print(f"    - Topics: {result.manifest.topic_count}")
    print(f"    - Total Content Blocks: {result.manifest.total_block_count}")
    print(f"    - Preserved Media Assets: {result.manifest.total_media_count}")
    print(f"    - Manifest SHA-256: {result.manifest_sha256}")
    print(f"    - Release Package: {args.output_dir / source_digest}")
    print(f"    - Release SQL: {args.output_dir / source_digest / 'release.sql'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
