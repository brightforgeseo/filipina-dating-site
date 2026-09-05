import pathlib, tomllib, unittest

class PermissionsTest(unittest.TestCase):
    def test_same_origin_media_without_third_party_access(self):
        data = tomllib.loads((pathlib.Path(__file__).parents[1] / 'netlify.toml').read_text())
        policy = next(h['values']['Permissions-Policy'] for h in data['headers'] if h['for'] == '/*')
        self.assertEqual(policy, 'camera=(self), microphone=(self), geolocation=()')

if __name__ == '__main__': unittest.main()
