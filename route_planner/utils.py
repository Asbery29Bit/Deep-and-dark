"""
Utility functions for pipeline route planning.

This module provides various utility functions used in the
route planning process, such as distance calculations and
coordinate parsing.
"""

import math
import re
from typing import Tuple, List, Dict, Any

def haversine_distance(point1: Tuple[float, float], point2: Tuple[float, float]) -> float:
    """
    Calculate the great-circle distance between two points on Earth.
    
    Args:
        point1: First point as (latitude, longitude)
        point2: Second point as (latitude, longitude)
        
    Returns:
        Distance in kilometers
    """
    # Earth radius in kilometers
    R = 6371.0
    
    # Convert coordinates to radians
    lat1, lon1 = math.radians(point1[0]), math.radians(point1[1])
    lat2, lon2 = math.radians(point2[0]), math.radians(point2[1])
    
    # Differences
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    # Haversine formula
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    
    return distance

def calculate_distance(points: List[Tuple[float, float]]) -> float:
    """
    Calculate total distance of a path.
    
    Args:
        points: List of points as (latitude, longitude)
        
    Returns:
        Total distance in kilometers
    """
    total_distance = 0.0
    for i in range(len(points) - 1):
        total_distance += haversine_distance(points[i], points[i+1])
    return total_distance

def parse_coordinates(coord_str: str) -> Tuple[float, float]:
    """
    Parse coordinate string into latitude and longitude.
    
    Args:
        coord_str: Coordinate string in format "lat,lng" or "lat, lng"
        
    Returns:
        Tuple of (latitude, longitude)
    """
    if not coord_str:
        raise ValueError("Координаты не указаны")
        
    # Remove any whitespace and split by comma
    parts = coord_str.strip().replace(" ", "").split(",")
    
    if len(parts) != 2:
        raise ValueError("Неверный формат координат. Используйте: широта,долгота")
    
    try:
        lat = float(parts[0])
        lng = float(parts[1])
    except ValueError:
        raise ValueError("Координаты должны быть числами")
    
    # Validate coordinate ranges
    if lat < -90 or lat > 90:
        raise ValueError("Широта должна быть в диапазоне от -90 до 90")
    if lng < -180 or lng > 180:
        raise ValueError("Долгота должна быть в диапазоне от -180 до 180")
    
    return (lat, lng)

def validate_input(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate input data for route calculation.
    
    Args:
        data: Input data dictionary
        
    Returns:
        Dictionary with validation result
    """
    # Check required fields
    required_fields = ['startPoint', 'endPoint']
    for field in required_fields:
        if field not in data or not data[field]:
            return {
                'valid': False,
                'message': f'Поле {field} обязательно для заполнения'
            }
    
    # Validate coordinates
    try:
        start_point = parse_coordinates(data['startPoint'])
    except ValueError as e:
        return {
            'valid': False,
            'message': f'Ошибка в начальной точке: {str(e)}'
        }
    
    try:
        end_point = parse_coordinates(data['endPoint'])
    except ValueError as e:
        return {
            'valid': False,
            'message': f'Ошибка в конечной точке: {str(e)}'
        }
    
    # Check if start and end points are different
    if start_point == end_point:
        return {
            'valid': False,
            'message': 'Начальная и конечная точки не могут совпадать'
        }
    
    # Validate pipe diameter
    if 'pipeDiameter' in data:
        try:
            pipe_diameter = float(data['pipeDiameter'])
            if pipe_diameter < 100 or pipe_diameter > 2000:
                return {
                    'valid': False,
                    'message': 'Диаметр трубопровода должен быть от 100 до 2000 мм'
                }
        except ValueError:
            return {
                'valid': False,
                'message': 'Диаметр трубопровода должен быть числом'
            }
    
    # Validate max pressure
    if 'maxPressure' in data:
        try:
            max_pressure = float(data['maxPressure'])
            if max_pressure < 1 or max_pressure > 100:
                return {
                    'valid': False,
                    'message': 'Максимальное давление должно быть от 1 до 100 атм'
                }
        except ValueError:
            return {
                'valid': False,
                'message': 'Максимальное давление должно быть числом'
            }
    
    # All validations passed
    return {
        'valid': True,
        'message': 'OK'
    }

def format_distance(distance: float) -> str:
    """
    Format distance in readable format.
    
    Args:
        distance: Distance in kilometers
        
    Returns:
        Formatted distance string
    """
    if distance < 1:
        # Convert to meters if less than 1 km
        meters = int(distance * 1000)
        return f"{meters} м"
    else:
        # Round to 2 decimal places
        return f"{distance:.2f} км"

def format_cost(cost: float) -> str:
    """
    Format cost in readable format.
    
    Args:
        cost: Cost in millions of rubles
        
    Returns:
        Formatted cost string
    """
    if cost < 1:
        # Convert to thousands if less than 1 million
        thousands = int(cost * 1000)
        return f"{thousands} тыс. ₽"
    else:
        # Round to 2 decimal places
        return f"{cost:.2f} млн. ₽"
