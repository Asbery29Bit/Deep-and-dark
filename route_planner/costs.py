"""
Cost calculation module for pipeline route planning.

This module provides functions to calculate various costs
associated with pipeline construction and operation.
"""

import math
from typing import Dict

def calculate_construction_cost(distance: float, diameter: float, 
                               material: str, terrain_difficulty: float,
                               pipe_type: str) -> float:
    """
    Calculate pipeline construction cost.
    
    Args:
        distance: Distance in kilometers
        diameter: Pipe diameter in millimeters
        material: Pipe material (steel, plastic, composite)
        terrain_difficulty: Terrain difficulty factor (0.0-1.0)
        pipe_type: Type of pipeline (oil, gas, water)
        
    Returns:
        Estimated construction cost in millions of rubles
    """
    # Base cost per kilometer based on pipe diameter (larger pipes cost more)
    # This formula gives reasonable costs in millions of rubles per km
    # For a 500mm pipe, base cost is around 10 million rubles per km
    base_cost_per_km = 0.00002 * (diameter ** 2) + 0.01 * diameter
    
    # Material cost factors
    material_factors = {
        'steel': 1.0,     # Standard material
        'plastic': 0.8,   # Cheaper than steel
        'composite': 1.4  # More expensive but better properties
    }
    material_factor = material_factors.get(material, 1.0)
    
    # Pipeline type factors (different types have different installation requirements)
    pipe_type_factors = {
        'oil': 1.2,    # Oil pipelines need more safety measures
        'gas': 1.3,    # Gas pipelines need pressure monitoring
        'water': 0.9   # Water pipelines are generally simpler
    }
    pipe_type_factor = pipe_type_factors.get(pipe_type, 1.0)
    
    # Terrain difficulty increases cost exponentially
    # A very difficult terrain can multiply costs by up to 3x
    terrain_factor = 1.0 + (terrain_difficulty ** 2) * 2.0
    
    # Calculate final cost
    cost = base_cost_per_km * material_factor * pipe_type_factor * terrain_factor * distance
    
    return cost

def calculate_environmental_impact(pipe_type: str, diameter: float, 
                                 terrain_difficulty: float) -> float:
    """
    Calculate environmental impact score.
    
    Args:
        pipe_type: Type of pipeline (oil, gas, water)
        diameter: Pipe diameter in millimeters
        terrain_difficulty: Terrain difficulty factor (0.0-1.0)
        
    Returns:
        Environmental impact score (0.0-1.0)
    """
    # Base impact based on pipeline type
    pipe_type_impact = {
        'oil': 0.7,    # Oil has high environmental risk
        'gas': 0.5,    # Gas has medium environmental risk
        'water': 0.2   # Water has low environmental risk
    }
    base_impact = pipe_type_impact.get(pipe_type, 0.5)
    
    # Diameter impact - larger pipes have more impact
    # Normalize to 0-1 range assuming 100-2000mm range
    diameter_normalized = min(max((diameter - 100) / 1900, 0), 1)
    diameter_factor = 0.3 + (diameter_normalized * 0.7)
    
    # Terrain impact - difficult terrain means more disruption
    terrain_factor = 0.5 + (terrain_difficulty * 0.5)
    
    # Combine factors with appropriate weights
    impact = (base_impact * 0.5) + (diameter_factor * 0.2) + (terrain_factor * 0.3)
    
    # Ensure result is in 0.0-1.0 range
    return min(max(impact, 0.0), 1.0)

def calculate_operational_costs(distance: float, diameter: float, 
                              terrain_difficulty: float, pipe_type: str) -> Dict[str, float]:
    """
    Calculate operational costs for the pipeline.
    
    Args:
        distance: Distance in kilometers
        diameter: Pipe diameter in millimeters
        terrain_difficulty: Terrain difficulty factor (0.0-1.0)
        pipe_type: Type of pipeline (oil, gas, water)
        
    Returns:
        Dictionary with operational cost components
    """
    # Base maintenance cost per year per km (in millions of rubles)
    base_maintenance = 0.001 * (diameter / 100) * distance
    
    # Terrain difficulty increases maintenance costs
    terrain_factor = 1.0 + terrain_difficulty
    
    # Pipeline type factors for maintenance
    pipe_type_factors = {
        'oil': 1.3,    # Oil requires more monitoring
        'gas': 1.4,    # Gas requires pressure monitoring
        'water': 0.9   # Water is generally simpler
    }
    type_factor = pipe_type_factors.get(pipe_type, 1.0)
    
    # Calculate maintenance cost
    maintenance_cost = base_maintenance * terrain_factor * type_factor
    
    # Pumping/compression cost depends on fluid type, distance and diameter
    # This is a simplified model
    flow_resistance = (distance / diameter) * 1000  # Simplified flow resistance
    
    # Different fluids have different pumping requirements
    pumping_factors = {
        'oil': 1.2,    # Oil is viscous
        'gas': 0.8,    # Gas requires compression
        'water': 0.9   # Water is the baseline
    }
    pumping_factor = pumping_factors.get(pipe_type, 1.0)
    
    # Calculate pumping cost (in millions of rubles per year)
    pumping_cost = 0.0005 * flow_resistance * pumping_factor
    
    # Inspection and monitoring costs
    inspection_cost = 0.0002 * distance * type_factor * (1 + (terrain_difficulty * 0.5))
    
    # Total operational cost per year
    total_operational = maintenance_cost + pumping_cost + inspection_cost
    
    return {
        'maintenance': maintenance_cost,
        'pumping': pumping_cost,
        'inspection': inspection_cost,
        'total': total_operational
    }
