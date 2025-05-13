# Importing calculate_distance to fix the import error.
import os
import math
import logging
from flask import Flask, render_template, request, jsonify
from route_planner.a_star import MultiCriteriaAStar
from route_planner.terrain import TerrainAnalyzer
import route_planner.utils
from route_planner.utils import calculate_distance

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default_secret_key_for_development")

# Initialize terrain analyzer
terrain_analyzer = TerrainAnalyzer()

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

@app.route('/new')
def new_index():
    """Render the new improved application page."""
    return render_template('new_index.html')

@app.route('/api/calculate_route', methods=['POST'])
def calculate_route():
    """API endpoint to calculate the optimal and alternative routes using multi-criteria A* algorithm."""
    try:
        data = request.json
        logger.debug(f"Received route calculation request: {data}")
        
        # Validate input parameters
        validation_result = route_planner.utils.validate_input(data)
        if not validation_result['valid']:
            return jsonify({'success': False, 'error': validation_result['message']}), 400
        
        # Parse start and end points
        start_point = route_planner.utils.parse_coordinates(data.get('startPoint'))
        end_point = route_planner.utils.parse_coordinates(data.get('endPoint'))
        
        # Get other parameters
        pipe_type = data.get('pipeType', 'oil')
        pipe_diameter = float(data.get('pipeDiameter', 500))
        pipe_material = data.get('pipeMaterial', 'steel')
        max_pressure = float(data.get('maxPressure', 10))
        
        # Get criteria weights from user input if available
        user_weights = data.get('criteriaWeights', {})
        
        # Create criteria weights based on input parameters
        criteria_weights = {
            'distance': 0.3,  # Base weight for distance
            'terrain_difficulty': 0.2,  # Terrain difficulty weight
            'environmental_impact': 0.15,  # Environmental impact weight
            'construction_cost': 0.2,  # Construction cost weight
            'maintenance_access': 0.15,  # Maintenance access weight
        }
        
        # Override with user-defined weights if provided
        if user_weights:
            for key in criteria_weights:
                if key in user_weights:
                    criteria_weights[key] = float(user_weights[key])
        
        # Normalize weights
        total_weight = sum(criteria_weights.values())
        if total_weight > 0:
            for key in criteria_weights:
                criteria_weights[key] = criteria_weights[key] / total_weight
        
        # Create A* algorithm instance
        astar = MultiCriteriaAStar(
            start=start_point,
            goal=end_point,
            terrain_analyzer=terrain_analyzer,
            pipe_diameter=pipe_diameter,
            pipe_material=pipe_material,
            max_pressure=max_pressure,
            pipe_type=pipe_type,
            criteria_weights=criteria_weights
        )
        
        # Calculate the route and alternatives
        logger.debug("Calling astar.find_paths() to calculate the route and alternatives...")
        paths = astar.find_paths(num_alternatives=2)  # Adjust the number of alternatives as needed

        # Ensure paths are in the correct format
        if not isinstance(paths, list) or not all(isinstance(item, tuple) and len(item) == 2 for item in paths):
            raise ValueError("astar.find_paths() returned an unexpected result format.")
        
        # Prepare the result data
        result_paths = []
        for i, (route, metrics) in enumerate(paths):
            if not route:
                continue  # Skip empty routes

            # Calculate total distance
            total_distance = route_planner.utils.calculate_distance(route)

            # Generate route description
            route_description = generate_route_description(
                start_point, 
                end_point, 
                route, 
                metrics, 
                terrain_analyzer,
                criteria_weights
            )
            
            # Calculate construction time in human-readable format
            construction_time = calculate_construction_time(
                metrics, 
                pipe_diameter, 
                pipe_type
            )
            
            # Append route details to the result
            result_paths.append({
                'route': route,
                'metrics': metrics,
                'total_distance': total_distance,
                'estimated_cost': metrics.get('estimated_cost', None),
                'terrain_difficulty': metrics.get('terrain_difficulty_score', None),
                'environmental_impact': metrics.get('environmental_impact_score', None),
                'construction_time': construction_time,
                'route_description': route_description,
                'alternative_num': metrics.get('alternative_num', 0)  # 0 for main route
            })
            
        logger.debug(f"Route calculation successful with {len(result_paths)} routes: {result_paths}")
        return jsonify({'success': True, 'routes': result_paths})
        
    except Exception as e:
        logger.error(f"Error calculating route: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка при расчете маршрута: {str(e)}'
        }), 500

@app.route('/api/terrain', methods=['GET'])
def get_terrain_data():
    """API endpoint to get terrain data for a specific area."""
    try:
        # Get bounding box coordinates
        north = float(request.args.get('north'))
        south = float(request.args.get('south'))
        east = float(request.args.get('east'))
        west = float(request.args.get('west'))

        # Get terrain data for the area
        terrain_data = terrain_analyzer.get_terrain_data(north, south, east, west)

        return jsonify({
            'success': True,
            'terrain_data': terrain_data
        })

    except Exception as e:
        logger.error(f"Error getting terrain data: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Произошла ошибка при получении данных о рельефе: {str(e)}'
        }), 500

def generate_route_description(start, end, route, metrics, terrain_analyzer, criteria_weights):
    """Generate a human-readable description of the route with detailed explanations."""
    # Start with basic information
    description = []

    # Calculate direct distance
    direct_distance = route_planner.utils.haversine_distance(start, end)

    # Add introduction
    description.append(f"Маршрут трубопровода: {route_planner.utils.format_distance(metrics['total_distance'])}.")

    # Compare to direct route
    efficiency = direct_distance / metrics['total_distance'] if metrics['total_distance'] > 0 else 0
    if efficiency > 0.9:
        description.append(f"Маршрут близок к прямой линии (эффективность {efficiency:.0%}).")
    else:
        description.append(f"Маршрут отклоняется от прямой линии (эффективность {efficiency:.0%}) из-за особенностей рельефа.")

    # Describe key features along the route
    terrain_features = []
    road_segments = 0
    water_crossings = 0
    difficult_terrain = 0

    # Generate detailed turn-by-turn description
    turns_description = []
    prev_direction = None

    # Analyze major turns and features
    for i in range(1, len(route)):
        if i == 1:
            # First segment
            turns_description.append(f"Маршрут начинается от точки ({route[0][0]:.4f}, {route[0][1]:.4f}).")

        prev = route[i-1]
        current = route[i]

        # Calculate direction change
        if i > 1:
            prev_prev = route[i-2]
            angle1 = math.atan2(prev[0] - prev_prev[0], prev[1] - prev_prev[1])
            angle2 = math.atan2(current[0] - prev[0], current[1] - prev[1])
            angle_diff = abs(angle1 - angle2)

            # If significant turn (more than ~15 degrees)
            if angle_diff > 0.26:
                # Determine turn reason
                turn_reason = _determine_turn_reason(prev, current, terrain_analyzer)

                # Direction in human terms (север, юг, etc.)
                direction = _get_direction(prev, current)

                if turn_reason:
                    turns_description.append(f"На расстоянии {route_planner.utils.format_distance(route_planner.utils.haversine_distance(route[0], prev))} маршрут поворачивает на {direction} {turn_reason}.")

        # Check for water crossings at this point
        lat, lng = current
        is_water, water_diff = terrain_analyzer.is_water_crossing(lat, lng)
        if is_water:
            water_crossings += 1
            river_crossing_point = f"На расстоянии {route_planner.utils.format_distance(route_planner.utils.haversine_distance(route[0], current))} маршрут пересекает водную преграду."
            if river_crossing_point not in turns_description:
                turns_description.append(river_crossing_point)

        # Check for road proximity
        is_near_road, road_bonus = terrain_analyzer.near_road(lat, lng)
        if is_near_road and road_bonus > 0:  # Only count if it's near road (not ON road)
            road_segments += 1

        # Check for difficult terrain
        terrain_diff = terrain_analyzer.get_terrain_difficulty(lat, lng)
        if terrain_diff > 0.7:
            difficult_terrain += 1
            difficult_point = f"На расстоянии {route_planner.utils.format_distance(route_planner.utils.haversine_distance(route[0], current))} маршрут проходит через участок сложного рельефа."
            if difficult_point not in turns_description:
                turns_description.append(difficult_point)

    # Add endpoint description
    turns_description.append(f"Маршрут заканчивается в точке ({route[-1][0]:.4f}, {route[-1][1]:.4f}).")

    # Add descriptions based on route features
    if water_crossings > 0:
        terrain_features.append(f"{water_crossings} пересечений водных преград")

    if difficult_terrain > 0:
        terrain_features.append(f"{difficult_terrain} участков сложного рельефа")

    if road_segments > len(route) * 0.3:
        terrain_features.append(f"проходит вдоль дорог на {road_segments} участках")

    # Explain route choice based on criteria weights
    weight_explanations = []

    if criteria_weights.get('environmental_impact', 0) > 0.3:
        weight_explanations.append("минимизации воздействия на окружающую среду")

    if criteria_weights.get('terrain_difficulty', 0) > 0.3:
        weight_explanations.append("минимизации сложности рельефа")

    if criteria_weights.get('maintenance_access', 0) > 0.3:
        weight_explanations.append("обеспечения доступа для обслуживания")

    if criteria_weights.get('construction_cost', 0) > 0.3:
        weight_explanations.append("снижения стоимости строительства")

    if weight_explanations:
        description.append("Маршрут проложен с учетом " + ", ".join(weight_explanations) + ".")

    # Add terrain features if any
    if terrain_features:
        description.append("Особенности маршрута: " + ", ".join(terrain_features) + ".")

    # Add turn-by-turn details
    if turns_description:
        description.append("Подробное описание маршрута:")
        description.extend(turns_description)

    # Construction and cost information
    description.append(f"Ориентировочная стоимость строительства: {route_planner.utils.format_cost(metrics['estimated_cost'])} млн руб.")

    return " ".join(description)

def _determine_turn_reason(prev, current, terrain_analyzer):
    """Determine the reason for a turn in the route."""
    lat, lng = prev
    new_lat, new_lng = current

    # Check for water bodies
    is_water, _ = terrain_analyzer.is_water_crossing(new_lat, new_lng)
    if is_water:
        return "для пересечения водной преграды"

    # Check if coming near a road
    is_near_road, road_bonus = terrain_analyzer.near_road(new_lat, new_lng)
    if is_near_road and road_bonus > 0:
        return "для следования вдоль дороги"

    # Check if avoiding a road (negative bonus = on the road)
    is_on_road, road_penalty = terrain_analyzer.near_road(lat + (new_lat - lat) * 0.5, lng + (new_lng - lng) * 0.5)
    if is_on_road and road_penalty < 0:
        return "для обхода дороги"

    # Check for difficult terrain
    difficulty_prev = terrain_analyzer.get_terrain_difficulty(lat, lng)
    difficulty_current = terrain_analyzer.get_terrain_difficulty(new_lat, new_lng)
    difficulty_between = terrain_analyzer.get_terrain_difficulty(
        lat + (new_lat - lat) * 0.5, 
        lng + (new_lng - lng) * 0.5
    )

    if difficulty_between > difficulty_current + 0.2:
        return "для обхода сложного участка рельефа"

    # Check for settlement nearby
    is_settlement, _ = terrain_analyzer.near_settlement(
        lat + (new_lat - lat) * 0.5, 
        lng + (new_lng - lng) * 0.5
    )
    if is_settlement:
        return "для обхода населенного пункта"

    # Default explanation
    if difficulty_current < difficulty_prev - 0.1:
        return "для выбора оптимального рельефа"

    return "согласно критериям оптимизации"

def _get_direction(prev, current):
    """Get human-readable direction from one point to another."""
    lat_diff = current[0] - prev[0]
    lng_diff = current[1] - prev[1]

    # Determine the dominant direction
    if abs(lat_diff) > abs(lng_diff):
        # North-South is dominant
        if lat_diff > 0:
            return "север"
        else:
            return "юг"
    else:
        # East-West is dominant
        if lng_diff > 0:
            return "восток"
        else:
            return "запад"


def calculate_construction_time(metrics, pipe_diameter, pipe_type):
    """Calculate estimated construction time based on route metrics."""
    # Base construction rate (km per day)
    if pipe_diameter <= 300:  # Small diameter
        base_rate = 0.5
    elif pipe_diameter <= 700:  # Medium diameter
        base_rate = 0.3
    else:  # Large diameter
        base_rate = 0.2

    # Adjust for pipe type
    type_factors = {
        'oil': 1.0,
        'gas': 1.2,  # Gas pipelines take longer
        'water': 0.9  # Water pipelines can be faster
    }

    # Factor in terrain difficulty
    terrain_factor = 1.0 + metrics['terrain_difficulty_score']

    # Calculate days needed
    total_distance = metrics['total_distance']
    days_needed = (total_distance / base_rate) * terrain_factor * type_factors.get(pipe_type, 1.0)

    # Add additional days for water crossings and complex construction
    days_needed = math.ceil(days_needed)

    # Convert to human-readable format
    if days_needed <= 30:
        return f"{days_needed} дней"
    elif days_needed <= 365:
        months = math.ceil(days_needed / 30)
        return f"{months} месяцев"
    else:
        years = days_needed / 365
        months = math.ceil((days_needed % 365) / 30)
        if months > 0:
            return f"{int(years)} лет и {months} месяцев"
        else:
            return f"{int(years)} лет"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)