"""
Sai Sankalp — Environment Variable Loader
Reads .env file and populates os.environ before any other module imports.
"""

import os

def load_env(env_path=None):
    """Load key=value pairs from a .env file into os.environ.
    
    Skips blank lines and comments (#). Does NOT overwrite existing 
    environment variables (system env takes precedence over .env file).
    """
    if env_path is None:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    
    if not os.path.exists(env_path):
        print(f"  [env_loader] No .env file found at {env_path} — using system env vars only.")
        return
    
    loaded = 0
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue
            # Split on first '=' only
            if '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()
            # Remove surrounding quotes if present
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            # Don't overwrite existing env vars
            if key not in os.environ:
                os.environ[key] = value
                loaded += 1
    
    print(f"  [env_loader] Loaded {loaded} variables from .env")


def get_env(key, default=None, required=False):
    """Get an environment variable with optional enforcement.
    
    Args:
        key: Environment variable name.
        default: Default value if not set. Ignored if required=True.
        required: If True, raises RuntimeError when the variable is missing.
    
    Returns:
        The value of the environment variable.
    """
    value = os.environ.get(key, default)
    if required and (value is None or value == ''):
        raise RuntimeError(
            f"FATAL: Required environment variable '{key}' is not set.\n"
            f"  Please add it to your .env file or set it in your system environment.\n"
            f"  See .env.example for reference."
        )
    return value


# Auto-load .env on import
load_env()
