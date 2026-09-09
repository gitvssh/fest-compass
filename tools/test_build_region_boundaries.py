import unittest
from tools.build_region_boundaries import link_region


class OfficialCrosswalkTest(unittest.TestCase):
    def test_same_name_without_matching_legal_code_is_rejected(self):
        row = dict(provinceCode="26", districtCode="110", provinceName="부산광역시", districtName="중구")
        table = {"26010": dict(province="부산광역시", name="중구", legal="3111000000")}
        self.assertEqual(link_region(row, table, table, {"26010"})["status"], "unverified")

    def test_renamed_or_changed_code_does_not_reuse_geometry(self):
        row = dict(provinceCode="28", districtCode="125", provinceName="인천광역시", districtName="제물포구")
        old = {"23010": dict(province="인천광역시", name="중구", legal="2811000000")}
        current = {"23010": dict(province="인천광역시", name="제물포구", legal="2812500000")}
        self.assertEqual(link_region(row, old, current, {"23010"})["status"], "changed")

    def test_partial_city_geometry_cannot_be_published_as_whole_city(self):
        row = dict(provinceCode="41", districtCode="110", provinceName="경기도", districtName="수원시")
        table = {"31010": dict(province="경기도", name="수원시", legal="4111000000"),
                 "31011": dict(province="경기도", name="수원시 장안구", legal="4111100000"),
                 "31012": dict(province="경기도", name="수원시 권선구", legal="4111300000" )}
        self.assertEqual(link_region(row, table, table, {"31011"})["status"], "missing")
        self.assertEqual(link_region(row, table, table, {"31011", "31012"})["codes"], ["31011", "31012"])


if __name__ == "__main__":
    unittest.main()
