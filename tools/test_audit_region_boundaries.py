import unittest
from tools.audit_region_boundaries import classify, read_dbf


class CandidateSafetyTest(unittest.TestCase):
    provinces = [{"SIDO_CD": "21", "SIDO_NM": "부산광역시"},
                 {"SIDO_CD": "26", "SIDO_NM": "울산광역시"},
                 {"SIDO_CD": "31", "SIDO_NM": "경기도"}]
    districts = [{"SIGUNGU_CD": "21010", "SIGUNGU_NM": "중구"},
                 {"SIGUNGU_CD": "26010", "SIGUNGU_NM": "중구"},
                 {"SIGUNGU_CD": "31011", "SIGUNGU_NM": "수원시 장안구"},
                 {"SIGUNGU_CD": "31012", "SIGUNGU_NM": "수원시 권선구"}]

    def check(self, province, district, status):
        result = classify({"provinceCode": "26", "provinceName": province,
                           "districtCode": "110", "districtName": district},
                          self.provinces, self.districts)
        self.assertEqual(result["status"], status)
        self.assertFalse(result["joinAllowed"])
        return result

    def test_numeric_code_collision_does_not_select_ulsan(self):
        self.assertEqual(self.check("부산광역시", "중구", "name-candidate")
                         ["sgisCandidates"][0]["code"], "21010")

    def test_unknown_province_cannot_match_common_district_name(self):
        self.assertEqual(self.check("전남광주통합특별시", "중구", "unresolved")
                         ["sgisCandidates"], [])

    def test_parent_city_requires_aggregation_review(self):
        self.assertEqual(len(self.check("경기도", "수원시", "aggregate-candidate")
                             ["sgisCandidates"]), 2)

    def test_new_district_cannot_inherit_old_parent_boundary(self):
        self.check("경기도", "화성시 동탄구", "unresolved")

    def test_duplicate_name_is_not_a_unique_join(self):
        result = classify({"provinceName": "부산광역시", "districtName": "중구"},
                          self.provinces, self.districts + [self.districts[0]])
        self.assertEqual(result["status"], "ambiguous")
        self.assertFalse(result["joinAllowed"])

    def test_malformed_dbf_is_rejected(self):
        with self.assertRaises(ValueError):
            read_dbf(bytes(40))


if __name__ == "__main__":
    unittest.main()
