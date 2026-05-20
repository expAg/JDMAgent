import tempfile
import pytest

from jdm_agent.client.cache import DiskJSONCache


@pytest.fixture
def temp_cache(tmp_path):
    return DiskJSONCache(cache_dir=tmp_path / "cache")
