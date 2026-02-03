import unittest
import sys
import os
import pandas as pd

# Add parent directory to path to import utils
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.matchmaking_utils import Matchmaker

class TestMatchmaking(unittest.TestCase):
    """
    Test matchmaking with realistic scenarios where expected pairings are clear.
    """

    def test_gender_preference_dealbreaker(self):
        """A straight guy should NOT be matched with a guy who likes guys"""
        users = [
            {'id': '1', 'gender': 'Male', 'gender_pref': 'Female', 'grade': 10, 'age': 15},
            {'id': '2', 'gender': 'Male', 'gender_pref': 'Male', 'grade': 10, 'age': 15},
        ]
        df = pd.DataFrame(users)
        matchmaker = Matchmaker(df)
        
        score = matchmaker.calculate_compatibility(users[0], users[1])
        self.assertEqual(score, 0, "Incompatible gender preferences should score 0")

    def test_perfect_basic_match(self):
        """Same grade, same age, matching genders - should score well"""
        users = [
            {'id': '1', 'gender': 'Male', 'gender_pref': 'Female', 'grade': 10, 'age': 16},
            {'id': '2', 'gender': 'Female', 'gender_pref': 'Male', 'grade': 10, 'age': 16},
        ]
        df = pd.DataFrame(users)
        matchmaker = Matchmaker(df)
        
        score = matchmaker.calculate_compatibility(users[0], users[1])
        self.assertGreater(score, 20, "Same grade/age with matching preferences should score decent")

    def test_grade_difference_penalty(self):
        """A 9th grader and 12th grader should score lower than same-grade peers"""
        same_grade = [
            {'id': '1', 'gender': 'Male', 'gender_pref': 'Female', 'grade': 10, 'age': 16},
            {'id': '2', 'gender': 'Female', 'gender_pref': 'Male', 'grade': 10, 'age': 16},
        ]
        diff_grade = [
            {'id': '3', 'gender': 'Male', 'gender_pref': 'Female', 'grade': 9, 'age': 14},
            {'id': '4', 'gender': 'Female', 'gender_pref': 'Male', 'grade': 12, 'age': 18},
        ]
        
        matchmaker = Matchmaker(pd.DataFrame(same_grade + diff_grade))
        
        same_score = matchmaker.calculate_compatibility(same_grade[0], same_grade[1])
        diff_score = matchmaker.calculate_compatibility(diff_grade[0], diff_grade[1])
        
        self.assertGreater(same_score, diff_score, 
            "Same grade should score higher than 3-grade difference")

    def test_similar_lifestyles_match_better(self):
        """Two homebodies should match better than a homebody and a party person"""
        homebody1 = {
            'id': '1', 'gender': 'Male', 'gender_pref': 'Female', 'grade': 10, 'age': 16,
            'home_out': 'Home', 'city_country': 'Countryside', 'text_call': 'Text',
            'extrovert_introvert': 25, 'social_battery': 1
        }
        homebody2 = {
            'id': '2', 'gender': 'Female', 'gender_pref': 'Male', 'grade': 10, 'age': 16,
            'home_out': 'Home', 'city_country': 'Countryside', 'text_call': 'Text',
            'extrovert_introvert': 30, 'social_battery': 1
        }
        party_person = {
            'id': '3', 'gender': 'Female', 'gender_pref': 'Male', 'grade': 10, 'age': 16,
            'home_out': 'Going Out', 'city_country': 'City', 'text_call': 'Call',
            'extrovert_introvert': 85, 'social_battery': 3
        }
        
        matchmaker = Matchmaker(pd.DataFrame([homebody1, homebody2, party_person]))
        
        homebody_match = matchmaker.calculate_compatibility(homebody1, homebody2)
        mismatch = matchmaker.calculate_compatibility(homebody1, party_person)
        
        self.assertGreater(homebody_match, mismatch,
            "Two homebodies should match better than homebody + party person")

    def test_complementary_qualities(self):
        """If A wants humor and B has humor, should score higher"""
        wants_humor = {
            'id': '1', 'gender': 'Male', 'gender_pref': 'Female', 'grade': 10, 'age': 16,
            'qualities_prefer': {'Intelligence': 10, 'Strength': 10, 'Confidence': 10, 'Humor': 50, 'Kindness': 20},
            'qualities_have': {'Intelligence': 30, 'Strength': 20, 'Confidence': 20, 'Humor': 10, 'Kindness': 20}
        }
        has_humor = {
            'id': '2', 'gender': 'Female', 'gender_pref': 'Male', 'grade': 10, 'age': 16,
            'qualities_prefer': {'Intelligence': 30, 'Strength': 10, 'Confidence': 10, 'Humor': 10, 'Kindness': 40},
            'qualities_have': {'Intelligence': 20, 'Strength': 10, 'Confidence': 10, 'Humor': 45, 'Kindness': 15}
        }
        no_humor = {
            'id': '3', 'gender': 'Female', 'gender_pref': 'Male', 'grade': 10, 'age': 16,
            'qualities_prefer': {'Intelligence': 30, 'Strength': 10, 'Confidence': 10, 'Humor': 10, 'Kindness': 40},
            'qualities_have': {'Intelligence': 30, 'Strength': 30, 'Confidence': 30, 'Humor': 5, 'Kindness': 5}
        }
        
        matchmaker = Matchmaker(pd.DataFrame([wants_humor, has_humor, no_humor]))
        
        good_match = matchmaker.calculate_compatibility(wants_humor, has_humor)
        bad_match = matchmaker.calculate_compatibility(wants_humor, no_humor)
        
        self.assertGreater(good_match, bad_match,
            "Person who wants humor should match better with person who has humor")

    def test_realistic_scenario_four_people(self):
        """
        Scenario: 4 students
        - Alex (M, likes F): Introvert homebody, likes Math, wants kind partner
        - Beth (F, likes M): Introvert homebody, likes Math, is kind
        - Carlos (M, likes F): Extrovert party guy, likes Music, wants confident partner  
        - Diana (F, likes M): Extrovert party girl, likes Music, is confident
        
        Expected: Alex-Beth, Carlos-Diana
        """
        alex = {
            'id': 'alex', 'email': 'alex@test.com',
            'gender': 'Male', 'gender_pref': 'Female', 'grade': 10, 'age': 16,
            'extrovert_introvert': 20, 'social_battery': 1,
            'home_out': 'Home', 'city_country': 'Countryside', 'text_call': 'Text',
            'fav_subject': 'Math', 'music_genre': 'Classical', 'sleep_time': '21:00',
            'qualities_prefer': {'Intelligence': 20, 'Strength': 5, 'Confidence': 10, 'Humor': 25, 'Kindness': 40},
            'qualities_have': {'Intelligence': 35, 'Strength': 10, 'Confidence': 15, 'Humor': 20, 'Kindness': 20}
        }
        beth = {
            'id': 'beth', 'email': 'beth@test.com',
            'gender': 'Female', 'gender_pref': 'Male', 'grade': 10, 'age': 16,
            'extrovert_introvert': 25, 'social_battery': 1,
            'home_out': 'Home', 'city_country': 'Countryside', 'text_call': 'Text',
            'fav_subject': 'Math', 'music_genre': 'Classical', 'sleep_time': '21:30',
            'qualities_prefer': {'Intelligence': 40, 'Strength': 5, 'Confidence': 10, 'Humor': 25, 'Kindness': 20},
            'qualities_have': {'Intelligence': 30, 'Strength': 5, 'Confidence': 10, 'Humor': 15, 'Kindness': 40}
        }
        carlos = {
            'id': 'carlos', 'email': 'carlos@test.com',
            'gender': 'Male', 'gender_pref': 'Female', 'grade': 10, 'age': 16,
            'extrovert_introvert': 80, 'social_battery': 3,
            'home_out': 'Going Out', 'city_country': 'City', 'text_call': 'Call',
            'fav_subject': 'Music', 'music_genre': 'Hip Hop', 'sleep_time': '00:00',
            'qualities_prefer': {'Intelligence': 10, 'Strength': 20, 'Confidence': 40, 'Humor': 20, 'Kindness': 10},
            'qualities_have': {'Intelligence': 15, 'Strength': 30, 'Confidence': 25, 'Humor': 20, 'Kindness': 10}
        }
        diana = {
            'id': 'diana', 'email': 'diana@test.com',
            'gender': 'Female', 'gender_pref': 'Male', 'grade': 10, 'age': 16,
            'extrovert_introvert': 75, 'social_battery': 3,
            'home_out': 'Going Out', 'city_country': 'City', 'text_call': 'Call',
            'fav_subject': 'Music', 'music_genre': 'Hip Hop', 'sleep_time': '00:30',
            'qualities_prefer': {'Intelligence': 10, 'Strength': 30, 'Confidence': 20, 'Humor': 25, 'Kindness': 15},
            'qualities_have': {'Intelligence': 15, 'Strength': 20, 'Confidence': 40, 'Humor': 15, 'Kindness': 10}
        }
        
        users = [alex, beth, carlos, diana]
        matchmaker = Matchmaker(pd.DataFrame(users))
        matches = matchmaker.run_matchmaking()
        
        # Should be 2 matches
        self.assertEqual(len(matches), 2, "Should have 2 matches for 4 people")
        
        # Verify pairings
        pairs = set()
        for m in matches:
            pairs.add(tuple(sorted([m[0]['email'], m[1]['email']])))
        
        self.assertIn(tuple(sorted(['alex@test.com', 'beth@test.com'])), pairs,
            "Alex and Beth should be matched (both introverted homebodies)")
        self.assertIn(tuple(sorted(['carlos@test.com', 'diana@test.com'])), pairs,
            "Carlos and Diana should be matched (both extroverted party people)")

    def test_gay_matching(self):
        """Two gay guys with compatible preferences should match"""
        users = [
            {'id': '1', 'email': 'guy1@test.com', 'gender': 'Male', 'gender_pref': 'Male', 
             'grade': 11, 'age': 17, 'home_out': 'Home', 'text_call': 'Text'},
            {'id': '2', 'email': 'guy2@test.com', 'gender': 'Male', 'gender_pref': 'Male', 
             'grade': 11, 'age': 17, 'home_out': 'Home', 'text_call': 'Text'},
        ]
        matchmaker = Matchmaker(pd.DataFrame(users))
        
        score = matchmaker.calculate_compatibility(users[0], users[1])
        self.assertGreater(score, 0, "Two gay guys who match preferences should have positive score")

    def test_no_preference_flexible(self):
        """Someone with 'No Preference' can match with anyone of compatible gender"""
        flexible = {
            'id': '1', 'gender': 'Female', 'gender_pref': 'No Preference',
            'grade': 10, 'age': 16
        }
        guy = {
            'id': '2', 'gender': 'Male', 'gender_pref': 'Female',
            'grade': 10, 'age': 16
        }
        girl = {
            'id': '3', 'gender': 'Female', 'gender_pref': 'Female',
            'grade': 10, 'age': 16
        }
        
        matchmaker = Matchmaker(pd.DataFrame([flexible, guy, girl]))
        
        # Flexible person can match with guy (he likes females)
        score_with_guy = matchmaker.calculate_compatibility(flexible, guy)
        self.assertGreater(score_with_guy, 0)
        
        # Flexible person can match with girl (girl likes females)
        score_with_girl = matchmaker.calculate_compatibility(flexible, girl)
        self.assertGreater(score_with_girl, 0)

if __name__ == '__main__':
    unittest.main()
