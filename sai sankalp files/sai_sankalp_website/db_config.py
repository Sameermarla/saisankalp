"""
Sai Sankalp — MySQL Database Configuration
Reads connection parameters from environment variables with sensible defaults.

Environment Variables:
    MYSQL_HOST      (default: localhost)
    MYSQL_PORT      (default: 3306)
    MYSQL_USER      (default: root)
    MYSQL_PASSWORD  (default: empty string)
    MYSQL_DATABASE  (default: saisankalp)
"""

import os
import env_loader

MYSQL_CONFIG = {
    "host": os.environ.get("MYSQL_HOST", "localhost"),
    "port": int(os.environ.get("MYSQL_PORT", 3306)),
    "user": os.environ.get("MYSQL_USER", "root"),
    "password": os.environ.get("MYSQL_PASSWORD", ""),
    "database": os.environ.get("MYSQL_DATABASE", "saisankalp"),
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
    "autocommit": False,
    "use_pure": True,
}

# Connection config WITHOUT database name — used only to auto-create the DB
MYSQL_CONFIG_NO_DB = {
    "host": MYSQL_CONFIG["host"],
    "port": MYSQL_CONFIG["port"],
    "user": MYSQL_CONFIG["user"],
    "password": MYSQL_CONFIG["password"],
    "charset": "utf8mb4",
    "collation": "utf8mb4_unicode_ci",
    "use_pure": True,
}

DATABASE_NAME = MYSQL_CONFIG["database"]
