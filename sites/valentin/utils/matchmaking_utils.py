import pandas as pd
import numpy as np
from scipy.optimize import linear_sum_assignment
from Levenshtein import distance as levenshtein_distance
import json

class Matchmaker:
    """
    Matchmaking based on ACTUAL compatibility, not abstract scoring.
    
    Types of matching:
    1. HARD REQUIREMENTS - Gender preferences (dealbreaker)
    2. SIMILARITY - Should be the SAME (interests, lifestyle, personality)
    3. COMPLEMENTARY - What A wants should match what B HAS
    4. PROXIMITY - Should be CLOSE (age, grade, location)
    """
    
    def __init__(self, data):
        self.df = data

    def calculate_compatibility(self, person_a, person_b):
        """
        Calculate how well two people would actually work together.
        Returns a score from 0-100 representing real compatibility.
        """
        
        # ===== HARD REQUIREMENTS (Dealbreakers) =====
        a_gender = person_a.get('gender', '')
        a_pref = person_a.get('gender_pref', 'No Preference')
        b_gender = person_b.get('gender', '')
        b_pref = person_b.get('gender_pref', 'No Preference')

        # If A has a preference and B doesn't match it -> 0
        if a_pref and a_pref != 'No Preference' and a_pref != b_gender:
            return 0
        # If B has a preference and A doesn't match it -> 0
        if b_pref and b_pref != 'No Preference' and b_pref != a_gender:
            return 0

        score = 0
        max_possible = 0

        # ===== PROXIMITY MATCHING (Should be close) =====
        # Grade: Same grade is ideal, 1 grade apart is okay, 2+ is bad
        max_possible += 15
        try:
            grade_diff = abs(int(person_a.get('grade', 0)) - int(person_b.get('grade', 0)))
            if grade_diff == 0:
                score += 15  # Same grade - perfect
            elif grade_diff == 1:
                score += 10  # One grade apart - good
            elif grade_diff == 2:
                score += 3   # Two grades - not great
            # 3+ grades apart = 0 points
        except (ValueError, TypeError):
            pass

        # Age: Similar logic
        max_possible += 10
        try:
            age_diff = abs(int(person_a.get('age', 0)) - int(person_b.get('age', 0)))
            if age_diff == 0:
                score += 10
            elif age_diff == 1:
                score += 7
            elif age_diff == 2:
                score += 3
        except (ValueError, TypeError):
            pass

        # ===== SIMILARITY MATCHING (Should be the same) =====
        
        # Personality: Extrovert/Introvert - similar people get along
        max_possible += 10
        try:
            a_extro = int(person_a.get('extrovert_introvert', 50))
            b_extro = int(person_b.get('extrovert_introvert', 50))
            # Both introverted (0-35), both middle (35-65), both extroverted (65-100)
            a_type = 'intro' if a_extro < 35 else ('extro' if a_extro > 65 else 'ambi')
            b_type = 'intro' if b_extro < 35 else ('extro' if b_extro > 65 else 'ambi')
            if a_type == b_type:
                score += 10
            elif 'ambi' in [a_type, b_type]:
                score += 5  # Ambiverts get along with anyone
        except (ValueError, TypeError):
            pass

        # Social Battery - similar energy levels
        max_possible += 8
        try:
            a_battery = int(person_a.get('social_battery', 2))
            b_battery = int(person_b.get('social_battery', 2))
            if a_battery == b_battery:
                score += 8
            elif abs(a_battery - b_battery) == 1:
                score += 4
        except (ValueError, TypeError):
            pass

        # Communication style - MUST match for relationship to work
        max_possible += 12
        a_comm = person_a.get('text_call')
        b_comm = person_b.get('text_call')
        if a_comm and b_comm:
            if a_comm == b_comm:
                score += 12

        # Lifestyle: Home vs Going Out - should match
        max_possible += 10
        a_home = person_a.get('home_out')
        b_home = person_b.get('home_out')
        if a_home and b_home:
            if a_home == b_home:
                score += 10

        # Lifestyle: City vs Countryside - future compatibility
        max_possible += 8
        a_city = person_a.get('city_country')
        b_city = person_b.get('city_country')
        if a_city and b_city:
            if a_city == b_city:
                score += 8

        # Sleep schedule - practical compatibility
        max_possible += 7
        try:
            a_sleep = person_a.get('sleep_time', '22:00')
            b_sleep = person_b.get('sleep_time', '22:00')
            if a_sleep and b_sleep:
                a_hour = int(a_sleep.split(':')[0])
                b_hour = int(b_sleep.split(':')[0])
                sleep_diff = abs(a_hour - b_hour)
                if sleep_diff <= 1:
                    score += 7
                elif sleep_diff <= 2:
                    score += 4
        except (ValueError, TypeError, AttributeError):
            pass

        # Shared interests - things to do together
        # Favorite subject
        max_possible += 5
        if person_a.get('fav_subject') and person_a.get('fav_subject') == person_b.get('fav_subject'):
            score += 5

        # Music genre - shared taste
        max_possible += 5
        if person_a.get('music_genre') and person_a.get('music_genre') == person_b.get('music_genre'):
            score += 5

        # Season preference
        max_possible += 3
        if person_a.get('fav_season') and person_a.get('fav_season') == person_b.get('fav_season'):
            score += 3

        # Ice cream - fun shared preference
        max_possible += 2
        if person_a.get('ice_cream') and person_a.get('ice_cream') == person_b.get('ice_cream'):
            score += 2

        # ===== COMPLEMENTARY MATCHING (A wants what B has) =====
        max_possible += 15  # 7.5 each direction
        try:
            a_prefers = self._parse_json(person_a.get('qualities_prefer', {}))
            a_has = self._parse_json(person_a.get('qualities_have', {}))
            b_prefers = self._parse_json(person_b.get('qualities_prefer', {}))
            b_has = self._parse_json(person_b.get('qualities_have', {}))
            
            qualities = ['Intelligence', 'Strength', 'Confidence', 'Humor', 'Kindness']
            
            # Does B have what A wants?
            if a_prefers and b_has:
                match_score = 0
                for q in qualities:
                    want = int(a_prefers.get(q, 0))
                    have = int(b_has.get(q, 0))
                    # If A wants it a lot (>20) and B has it (>15), good match
                    if want > 20 and have >= want * 0.7:
                        match_score += 1
                score += (match_score / 5) * 7.5
                
            # Does A have what B wants?
            if b_prefers and a_has:
                match_score = 0
                for q in qualities:
                    want = int(b_prefers.get(q, 0))
                    have = int(a_has.get(q, 0))
                    if want > 20 and have >= want * 0.7:
                        match_score += 1
                score += (match_score / 5) * 7.5
                
        except (ValueError, TypeError, json.JSONDecodeError):
            pass

        # Normalize to 0-100 based on max possible
        if max_possible > 0:
            return min(100, (score / max_possible) * 100)
        return 0

    def _parse_json(self, data):
        """Safely parse JSON data"""
        if isinstance(data, dict):
            return data
        if isinstance(data, str) and data:
            try:
                return json.loads(data)
            except:
                return {}
        return {}

    def run_matchmaking(self):
        """Run the Hungarian algorithm to find optimal matches"""
        users = self.df.to_dict('records')
        n = len(users)
        
        if n < 2:
            return []
        
        # Build cost matrix (we minimize cost = maximize compatibility)
        cost_matrix = np.zeros((n, n))
        max_score = 100

        for i in range(n):
            for j in range(n):
                if i == j:
                    cost_matrix[i][j] = 9999  # Can't match with self
                else:
                    score = self.calculate_compatibility(users[i], users[j])
                    cost_matrix[i][j] = max_score - score

        # Run Hungarian algorithm
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        
        # Extract unique pairs
        matches = []
        matched_indices = set()
        
        for i, j in zip(row_ind, col_ind):
            if i in matched_indices or j in matched_indices:
                continue
            if i == j:
                continue
                
            score = max_score - cost_matrix[i][j]
            
            if score > 0:
                matches.append((users[i], users[j], score))
                matched_indices.add(i)
                matched_indices.add(j)
            
        matches.sort(key=lambda x: x[2], reverse=True)
        
        return matches

