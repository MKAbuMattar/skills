#!/usr/bin/env python3
"""
{{SCRIPT_NAME}} - {{SCRIPT_DESCRIPTION}}

Version: 1.0
Author: {{AUTHOR}}
License: MIT
"""

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Constants
SCRIPT_DIR = Path(__file__).resolve().parent
VERSION = "1.0.0"


class Colors:
    """ANSI color codes for terminal output."""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

    @staticmethod
    def success(msg: str) -> str:
        """Return success message with color."""
        return f"{Colors.GREEN}✓ {msg}{Colors.RESET}"

    @staticmethod
    def error(msg: str) -> str:
        """Return error message with color."""
        return f"{Colors.RED}✗ {msg}{Colors.RESET}"

    @staticmethod
    def info(msg: str) -> str:
        """Return info message with color."""
        return f"{Colors.BLUE}ℹ {msg}{Colors.RESET}"

    @staticmethod
    def warn(msg: str) -> str:
        """Return warning message with color."""
        return f"{Colors.YELLOW}⚠ {msg}{Colors.RESET}"


def parse_args() -> argparse.Namespace:
    """
    Parse command-line arguments.

    Returns:
        Parsed arguments namespace
    """
    parser = argparse.ArgumentParser(
        description='{{SCRIPT_DESCRIPTION}}',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s input.txt
    %(prog)s -v --output result.txt input.txt
    %(prog)s --config custom.yaml input.txt
        """
    )

    # Positional arguments
    parser.add_argument(
        'input',
        type=Path,
        help='Input file path'
    )

    # Optional arguments
    parser.add_argument(
        '-o', '--output',
        type=Path,
        help='Output file path (default: stdout)'
    )

    parser.add_argument(
        '-c', '--config',
        type=Path,
        default=SCRIPT_DIR / 'config.yaml',
        help='Configuration file path'
    )

    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Enable verbose output (DEBUG level logging)'
    )

    parser.add_argument(
        '--version',
        action='version',
        version=f'%(prog)s {VERSION}'
    )

    return parser.parse_args()


def validate_input(input_path: Path) -> None:
    """
    Validate input file exists and is readable.

    Args:
        input_path: Path to input file

    Raises:
        FileNotFoundError: If file doesn't exist
        PermissionError: If file isn't readable
    """
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if not input_path.is_file():
        raise ValueError(f"Input path is not a file: {input_path}")

    if not input_path.stat().st_size:
        logger.warning(f"Input file is empty: {input_path}")


def process_data(
    input_path: Path,
    output_path: Optional[Path] = None,
    config: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Process input data and write to output.

    Args:
        input_path: Path to input file
        output_path: Optional path to output file
        config: Optional configuration dictionary

    Returns:
        True if processing successful

    Raises:
        FileNotFoundError: If input file doesn't exist
        ValueError: If input data is invalid
    """
    logger.info(f"Processing {input_path}")

    try:
        # Read input file
        content = input_path.read_text(encoding='utf-8')
        logger.debug(f"Read {len(content)} characters from {input_path}")

        # TODO: Add your processing logic here
        processed = content  # Replace with actual processing

        # Write output
        if output_path:
            output_path.write_text(processed, encoding='utf-8')
            logger.info(f"Wrote output to {output_path}")
        else:
            print(processed)

        return True

    except UnicodeDecodeError as e:
        logger.error(f"Failed to decode file {input_path}: {e}")
        raise ValueError(f"Invalid file encoding: {e}")

    except Exception as e:
        logger.error(f"Processing failed: {e}")
        raise


def main() -> int:
    """
    Main entry point.

    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    args = parse_args()

    # Configure logging level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")

    try:
        # Validate inputs
        validate_input(args.input)

        # Load configuration if provided
        config = None
        if args.config and args.config.exists():
            logger.debug(f"Loading config from {args.config}")
            # TODO: Implement config loading (YAML/JSON)

        # Process data
        success = process_data(
            input_path=args.input,
            output_path=args.output,
            config=config
        )

        if success:
            print(Colors.success("Processing completed successfully"))
            return 0
        else:
            print(Colors.error("Processing failed"))
            return 1

    except FileNotFoundError as e:
        logger.error(str(e))
        print(Colors.error(f"File not found: {e}"))
        return 1

    except ValueError as e:
        logger.error(str(e))
        print(Colors.error(f"Invalid input: {e}"))
        return 2

    except PermissionError as e:
        logger.error(str(e))
        print(Colors.error(f"Permission denied: {e}"))
        return 3

    except KeyboardInterrupt:
        logger.info("Interrupted by user")
        print(Colors.warn("\nOperation cancelled by user"))
        return 130

    except Exception as e:
        logger.exception("Unexpected error occurred")
        print(Colors.error(f"Unexpected error: {e}"))
        if args.verbose:
            raise
        return 4


if __name__ == '__main__':
    sys.exit(main())
