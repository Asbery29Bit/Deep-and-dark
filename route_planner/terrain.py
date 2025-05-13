"""
Terrain analysis module for pipeline route planning.

This module provides functionality to analyze terrain characteristics
for pipeline route planning, including elevation, slope, soil types,
and other geographical features.
"""

import logging
import random
import math
from typing import Dict, Tuple, Optional, Any, List

logger = logging.getLogger(__name__)

class TerrainAnalyzer:
    """Terrain analyzer for pipeline route planning."""

    def __init__(self):
        """Initialize the terrain analyzer."""
        self.terrain_cache = {}
        self.protected_areas = self._load_protected_areas()
        self.rivers = self._load_rivers()
        self.roads = self._load_roads()
        self.settlements = self._load_settlements()
        logger.info("TerrainAnalyzer initialized")
    
    def _load_protected_areas(self) -> List[Dict[str, Any]]:
        """
        Load protected areas data.
        
        Returns:
            List of protected areas with coordinates and characteristics
        """
        # In a real implementation, this would load from a database or GIS file
        # For this implementation, we'll use some sample protected areas in Irkutsk region
        return [
            {
                'name': 'Прибайкальский национальный парк',
                'center': (52.0, 105.5),
                'radius': 0.5,  # degrees
                'impact_factor': 0.9  # High impact factor
            },
            {
                'name': 'Байкало-Ленский заповедник',
                'center': (53.5, 107.8),
                'radius': 0.4,
                'impact_factor': 0.95
            }
        ]
    
    def _load_rivers(self) -> List[Dict[str, Any]]:
        """
        Load rivers data.
        
        Returns:
            List of rivers with coordinates and characteristics
        """
        # Simplified rivers data for Irkutsk region
        return [
            {
                'name': 'Ангара',
                'points': [(52.3, 104.3), (52.5, 104.2), (52.7, 104.0), (52.9, 103.8)],
                'width': 0.01,  # degrees
                'crossing_difficulty': 0.8
            },
            {
                'name': 'Лена',
                'points': [(53.1, 105.5), (53.3, 105.7), (53.5, 105.9)],
                'width': 0.008,
                'crossing_difficulty': 0.7
            }
        ]
    
    def _load_roads(self) -> List[Dict[str, Any]]:
        """
        Load roads data.
        
        Returns:
            List of roads with coordinates and characteristics
        """
        # Simplified roads data for Irkutsk region
        return [
            {
                'name': 'М53',
                'points': [(52.2, 104.1), (52.3, 104.3), (52.4, 104.5)],
                'width': 0.003,
                'accessibility_bonus': 0.6
            },
            {
                'name': 'М55',
                'points': [(52.3, 104.3), (52.3, 104.5), (52.3, 104.7)],
                'width': 0.002,
                'accessibility_bonus': 0.5
            }
        ]
    
    def _load_settlements(self) -> List[Dict[str, Any]]:
        """
        Load settlements data.
        
        Returns:
            List of settlements with coordinates and characteristics
        """
        # Simplified settlements data for Irkutsk region
        return [
            {
                'name': 'Иркутск',
                'center': (52.3, 104.3),
                'radius': 0.1,
                'population': 600000,
                'restriction_factor': 0.8
            },
            {
                'name': 'Ангарск',
                'center': (52.5, 103.9),
                'radius': 0.07,
                'population': 220000,
                'restriction_factor': 0.7
            }
        ]
    
    def get_elevation(self, lat: float, lng: float) -> float:
        """
        Get elevation data for a specific point.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Elevation in meters
        """
        # In a real implementation, this would query a DEM (Digital Elevation Model)
        # For this implementation, we'll generate a realistic elevation model for the region
        cache_key = f"{lat:.5f}_{lng:.5f}_elev"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        # Base elevation for Irkutsk region (around 500m)
        base_elevation = 500
        
        # Add some variation based on coordinates
        # This creates a realistic terrain pattern
        x_factor = math.sin(lat * 10) * math.cos(lng * 8) * 200
        y_factor = math.sin(lng * 12) * math.cos(lat * 9) * 150
        
        # Add some random variation (small hills)
        random_factor = random.uniform(-50, 50)
        
        # Combine factors for final elevation
        elevation = base_elevation + x_factor + y_factor + random_factor
        
        # Cache the result
        self.terrain_cache[cache_key] = elevation
        return elevation
    
    def get_slope(self, lat: float, lng: float) -> float:
        """
        Calculate terrain slope at a specific point.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Slope as a value between 0.0 (flat) and 1.0 (very steep)
        """
        cache_key = f"{lat:.5f}_{lng:.5f}_slope"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        # Calculate slope based on elevation difference with nearby points
        grid_size = 0.001  # About 100m
        
        elev_center = self.get_elevation(lat, lng)
        elev_north = self.get_elevation(lat + grid_size, lng)
        elev_east = self.get_elevation(lat, lng + grid_size)
        
        # Calculate slope based on elevation differences
        delta_north = abs(elev_north - elev_center)
        delta_east = abs(elev_east - elev_center)
        
        # Convert to a 0.0-1.0 scale where 1.0 is extremely steep (approx 45 degrees or more)
        slope_north = min(delta_north / 100, 1.0)
        slope_east = min(delta_east / 100, 1.0)
        
        # Use the max slope direction
        slope = max(slope_north, slope_east)
        
        # Cache the result
        self.terrain_cache[cache_key] = slope
        return slope
    
    def get_soil_type(self, lat: float, lng: float) -> str:
        """
        Get soil type at a specific point.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Soil type as a string
        """
        cache_key = f"{lat:.5f}_{lng:.5f}_soil"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        # In a real implementation, this would query a soils database
        # For this implementation, we'll generate consistent soil types
        
        # Use the coordinates to deterministically assign soil types
        # This ensures consistent results for the same coordinate
        soil_types = ['clay', 'loam', 'sand', 'rock', 'peat']
        
        # Generate a value between 0 and 1 based on coordinates
        value = ((math.sin(lat * 100) + 1) / 2 + (math.cos(lng * 100) + 1) / 2) / 2
        
        # Select soil type based on the value
        index = min(int(value * len(soil_types)), len(soil_types) - 1)
        soil_type = soil_types[index]
        
        # Cache the result
        self.terrain_cache[cache_key] = soil_type
        return soil_type
    
    def is_protected_area(self, lat: float, lng: float) -> Tuple[bool, float]:
        """
        Check if a point is in a protected environmental area.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Tuple of (is_protected, impact_factor)
        """
        cache_key = f"{lat:.5f}_{lng:.5f}_protected"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        for area in self.protected_areas:
            center_lat, center_lng = area['center']
            distance = math.sqrt((lat - center_lat)**2 + (lng - center_lng)**2)
            
            if distance <= area['radius']:
                result = (True, area['impact_factor'])
                self.terrain_cache[cache_key] = result
                return result
        
        result = (False, 0.0)
        self.terrain_cache[cache_key] = result
        return result
    
    def is_water_crossing(self, lat: float, lng: float) -> Tuple[bool, float]:
        """
        Check if a point requires crossing a water body.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Tuple of (is_water_crossing, difficulty_factor)
        """
        cache_key = f"{lat:.5f}_{lng:.5f}_water"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        for river in self.rivers:
            for i in range(len(river['points']) - 1):
                start_lat, start_lng = river['points'][i]
                end_lat, end_lng = river['points'][i + 1]
                
                # Check if point is near this river segment
                dist = self._point_to_line_distance(
                    lat, lng, start_lat, start_lng, end_lat, end_lng)
                
                if dist <= river['width']:
                    result = (True, river['crossing_difficulty'])
                    self.terrain_cache[cache_key] = result
                    return result
        
        result = (False, 0.0)
        self.terrain_cache[cache_key] = result
        return result
    
    def _point_to_line_distance(self, px: float, py: float, x1: float, y1: float, 
                               x2: float, y2: float) -> float:
        """
        Calculate distance from a point to a line segment.
        
        Args:
            px, py: Point coordinates
            x1, y1: Line segment start
            x2, y2: Line segment end
            
        Returns:
            Distance from point to line
        """
        # Vector from start to end
        dx = x2 - x1
        dy = y2 - y1
        
        # If the line is just a point, return distance to that point
        if dx == 0 and dy == 0:
            return math.sqrt((px - x1)**2 + (py - y1)**2)
        
        # Calculate projection of point onto line
        t = ((px - x1) * dx + (py - y1) * dy) / (dx*dx + dy*dy)
        
        # If projection is outside the line segment, use distance to closest endpoint
        if t < 0:
            return math.sqrt((px - x1)**2 + (py - y1)**2)
        elif t > 1:
            return math.sqrt((px - x2)**2 + (py - y2)**2)
        
        # Calculate closest point on line
        closest_x = x1 + t * dx
        closest_y = y1 + t * dy
        
        # Return distance to closest point
        return math.sqrt((px - closest_x)**2 + (py - closest_y)**2)
    
    def near_road(self, lat: float, lng: float) -> Tuple[bool, float]:
        """
        Check if a point is near a road (for accessibility).
        The function distinguishes between being directly on a road (not ideal for a pipeline)
        and being near a road (optimal for maintenance access).
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Tuple of (is_near_road, accessibility_bonus)
            accessibility_bonus is positive for optimal proximity, negative for being directly on road
        """
        cache_key = f"{lat:.5f}_{lng:.5f}_road"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        for road in self.roads:
            for i in range(len(road['points']) - 1):
                start_lat, start_lng = road['points'][i]
                end_lat, end_lng = road['points'][i + 1]
                
                # Check if point is near this road segment
                dist = self._point_to_line_distance(
                    lat, lng, start_lat, start_lng, end_lat, end_lng)
                
                # If directly on the road or very close (inside road width) - not ideal for pipelines
                if dist <= road['width']:
                    # Penalize being directly ON roads (slight negative bonus)
                    logger.debug(f"Position {lat},{lng} is directly ON road")
                    result = (True, -0.2)  # Negative bonus for being directly on road
                    self.terrain_cache[cache_key] = result
                    return result
                
                # Optimal distance: close enough for maintenance access, but not ON the road
                # Between 1x and 5x the road width
                elif dist <= road['width'] * 5:
                    # Calculate ideal bonus based on distance from road
                    # Maximum bonus at around 2x road width, decreasing as you get closer or farther
                    optimal_dist = road['width'] * 2  # Ideal distance from road center
                    proximity_factor = 1.0 - abs(dist - optimal_dist) / (road['width'] * 3)
                    adjusted_bonus = road['accessibility_bonus'] * proximity_factor
                    
                    logger.debug(f"Position {lat},{lng} is at optimal distance from road, bonus: {adjusted_bonus:.2f}")
                    result = (True, adjusted_bonus)
                    self.terrain_cache[cache_key] = result
                    return result
        
        result = (False, 0.0)
        self.terrain_cache[cache_key] = result
        return result
    
    def near_settlement(self, lat: float, lng: float) -> Tuple[bool, float]:
        """
        Check if a point is near a settlement.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Tuple of (is_near_settlement, restriction_factor)
        """
        cache_key = f"{lat:.5f}_{lng:.5f}_settlement"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        for settlement in self.settlements:
            center_lat, center_lng = settlement['center']
            distance = math.sqrt((lat - center_lat)**2 + (lng - center_lng)**2)
            
            if distance <= settlement['radius']:
                result = (True, settlement['restriction_factor'])
                self.terrain_cache[cache_key] = result
                return result
        
        result = (False, 0.0)
        self.terrain_cache[cache_key] = result
        return result
    
    def get_terrain_difficulty(self, lat: float, lng: float) -> float:
        """
        Calculate overall terrain difficulty at a specific point.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Terrain difficulty as a value between 0.0 (easy) and 1.0 (extremely difficult)
        """
        cache_key = f"{lat:.5f}_{lng:.5f}_difficulty"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        # Calculate components of difficulty
        slope = self.get_slope(lat, lng)
        soil_type = self.get_soil_type(lat, lng)
        is_protected, protection_factor = self.is_protected_area(lat, lng)
        is_water, water_difficulty = self.is_water_crossing(lat, lng)
        is_settlement, settlement_restriction = self.near_settlement(lat, lng)
        
        # Soil difficulty factors
        soil_factors = {
            'clay': 0.4,
            'loam': 0.2,
            'sand': 0.3,
            'rock': 0.8,
            'peat': 0.6
        }
        
        # Base difficulty from slope and soil
        difficulty = 0.3 * slope + 0.2 * soil_factors.get(soil_type, 0.3)
        
        # Add water crossing difficulty if applicable
        if is_water:
            difficulty += 0.25 * water_difficulty
        
        # Add protected area penalty if applicable
        if is_protected:
            difficulty += 0.15 * protection_factor
        
        # Add settlement restriction if applicable
        if is_settlement:
            difficulty += 0.1 * settlement_restriction
        
        # Normalize to 0.0-1.0 range
        difficulty = min(max(difficulty, 0.0), 1.0)
        
        # Cache the result
        self.terrain_cache[cache_key] = difficulty
        return difficulty
    
    def get_accessibility(self, lat: float, lng: float) -> float:
        """
        Calculate accessibility score at a specific point.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            Accessibility as a value between 0.0 (inaccessible) and 1.0 (easily accessible)
        """
        cache_key = f"{lat:.5f}_{lng:.5f}_access"
        if cache_key in self.terrain_cache:
            return self.terrain_cache[cache_key]
        
        # Base accessibility (inverse of terrain difficulty)
        terrain_difficulty = self.get_terrain_difficulty(lat, lng)
        accessibility = 1.0 - terrain_difficulty * 0.6  # Base accessibility
        
        # Check if location is near a road
        is_near_road, road_bonus = self.near_road(lat, lng)
        if is_near_road:
            accessibility += road_bonus * 0.4  # Bonus for being near a road
        
        # Normalize to 0.0-1.0 range
        accessibility = min(max(accessibility, 0.0), 1.0)
        
        # Cache the result
        self.terrain_cache[cache_key] = accessibility
        return accessibility
    
    def is_valid_position(self, lat: float, lng: float) -> bool:
        """
        Check if a position is valid for pipeline routing.
        
        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate
            
        Returns:
            True if position is valid, False otherwise
        """
        # Basic validity check - within sensible bounds
        if lat < -90 or lat > 90 or lng < -180 or lng > 180:
            return False
            
        # Check if in restricted zones (national parks, cities, protected areas)
        
        # Major cities to avoid
        restricted_cities = [
            # City center coordinates and radius in degrees
            # Иркутск
            {"lat": 52.3, "lng": 104.3, "radius": 0.12, "name": "Иркутск"},
            # Ангарск
            {"lat": 52.5, "lng": 103.9, "radius": 0.08, "name": "Ангарск"},
            # Шелехов
            {"lat": 52.2, "lng": 104.08, "radius": 0.04, "name": "Шелехов"},
            # Усолье-Сибирское
            {"lat": 52.75, "lng": 103.65, "radius": 0.05, "name": "Усолье-Сибирское"}
        ]
        
        # Protected natural areas to avoid
        protected_areas = [
            # Прибайкальский национальный парк
            {"lat": 53.2, "lng": 107.35, "radius": 0.35, "name": "Прибайкальский национальный парк"},
            # Байкало-Ленский заповедник
            {"lat": 53.9, "lng": 108.0, "radius": 0.40, "name": "Байкало-Ленский заповедник"},
            # Байкальский заповедник
            {"lat": 51.5, "lng": 105.0, "radius": 0.30, "name": "Байкальский заповедник"}
        ]
        
        # Check if point is within restricted cities or very close to cities
        for city in restricted_cities:
            city_distance = math.sqrt((lat - city["lat"])**2 + (lng - city["lng"])**2)
            
            # Строго запрещаем строительство внутри городов
            if city_distance <= city["radius"]:
                logger.debug(f"Position {lat},{lng} is inside restricted city area {city['name']}")
                return False
                
            # Также предупреждаем о близости к границам города (в пределах 1.2 радиуса)
            if city_distance <= city["radius"] * 1.2:
                logger.debug(f"Position {lat},{lng} is close to restricted city area {city['name']}")
                # Это не запрещено, но будет учитываться в оценке маршрута
                
        # Check if point is within protected areas
        for area in protected_areas:
            area_distance = math.sqrt((lat - area["lat"])**2 + (lng - area["lng"])**2)
            if area_distance <= area["radius"]:
                logger.debug(f"Position {lat},{lng} is inside protected area {area['name']}")
                return False
        
        # For this implementation, make most positions valid to ensure paths can be found
        # Only extreme restrictions apply
        
        # Check if in extreme protected area with very high impact
        is_protected, impact_factor = self.is_protected_area(lat, lng)
        if is_protected and impact_factor > 0.95:  # Only highest impact areas restricted
            return False
        
        # Check if in extreme restricted settlement
        is_settlement, restriction_factor = self.near_settlement(lat, lng)
        if is_settlement and restriction_factor > 0.95:  # Only highest restriction areas
            return False
        
        # Otherwise allow the position
        return True
    
    def get_terrain_data(self, north: float, south: float, east: float, west: float) -> Dict[str, Any]:
        """
        Get terrain data for a rectangular area.
        
        Args:
            north: Northern boundary latitude
            south: Southern boundary latitude
            east: Eastern boundary longitude
            west: Western boundary longitude
            
        Returns:
            Dictionary with terrain data
        """
        # Generate grid of terrain data
        grid_size = 0.01  # Grid resolution (approx 1km)
        terrain_grid = []
        
        for lat in self._frange(south, north, grid_size):
            row = []
            for lng in self._frange(west, east, grid_size):
                cell_data = {
                    'position': (lat, lng),
                    'elevation': self.get_elevation(lat, lng),
                    'difficulty': self.get_terrain_difficulty(lat, lng),
                    'accessibility': self.get_accessibility(lat, lng)
                }
                row.append(cell_data)
            
            terrain_grid.append(row)
        
        # Get features in the area
        features = []
        
        # Add rivers in the area
        for river in self.rivers:
            river_in_area = False
            for point in river['points']:
                lat, lng = point
                if south <= lat <= north and west <= lng <= east:
                    river_in_area = True
                    break
            
            if river_in_area:
                features.append({
                    'type': 'river',
                    'name': river['name'],
                    'points': river['points'],
                    'width': river['width']
                })
        
        # Add roads in the area
        for road in self.roads:
            road_in_area = False
            for point in road['points']:
                lat, lng = point
                if south <= lat <= north and west <= lng <= east:
                    road_in_area = True
                    break
            
            if road_in_area:
                features.append({
                    'type': 'road',
                    'name': road['name'],
                    'points': road['points']
                })
        
        # Add settlements in the area
        for settlement in self.settlements:
            lat, lng = settlement['center']
            if (south - settlement['radius'] <= lat <= north + settlement['radius'] and
                west - settlement['radius'] <= lng <= east + settlement['radius']):
                features.append({
                    'type': 'settlement',
                    'name': settlement['name'],
                    'center': settlement['center'],
                    'radius': settlement['radius']
                })
        
        # Add protected areas in the area
        for area in self.protected_areas:
            lat, lng = area['center']
            if (south - area['radius'] <= lat <= north + area['radius'] and
                west - area['radius'] <= lng <= east + area['radius']):
                features.append({
                    'type': 'protected_area',
                    'name': area['name'],
                    'center': area['center'],
                    'radius': area['radius']
                })
        
        return {
            'grid': terrain_grid,
            'features': features,
            'bounds': {
                'north': north,
                'south': south,
                'east': east,
                'west': west
            }
        }
    
    def _frange(self, start: float, stop: float, step: float) -> List[float]:
        """
        Range function for floating point numbers.
        
        Args:
            start: Starting value
            stop: Ending value
            step: Step size
            
        Returns:
            List of floating point values
        """
        result = []
        current = start
        while current <= stop:
            result.append(current)
            current += step
        return result
