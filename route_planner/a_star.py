"""
Multi-criteria A* algorithm implementation for pipeline route planning.

This module provides the core algorithm for finding optimal pipeline routes
based on multiple weighted criteria like distance, terrain, cost, etc.
"""

import heapq
import math
import logging
import numpy as np
from typing import Dict, List, Tuple, Set, Optional, Any, Union

from route_planner.costs import calculate_construction_cost, calculate_environmental_impact
from route_planner.terrain import TerrainAnalyzer
from route_planner.utils import calculate_distance, haversine_distance

logger = logging.getLogger(__name__)

class Node:
    """A node in the search graph for A* algorithm."""

    def __init__(self, position: Tuple[float, float], g_score: Dict[str, float], 
                 parent: Optional['Node'] = None):
        """
        Initialize a node.

        Args:
            position: Tuple of (latitude, longitude) coordinates
            g_score: Dictionary of g-scores for each criterion
            parent: Parent node in the path
        """
        self.position = position
        self.g_score = g_score
        self.f_score = 0.0  # Will be calculated in the algorithm
        self.parent = parent

    def __lt__(self, other: 'Node') -> bool:
        """Compare nodes based on f_score for priority queue."""
        return self.f_score < other.f_score

    def __eq__(self, other: object) -> bool:
        """Check if two nodes are at the same position."""
        if not isinstance(other, Node):
            return False
        return self.position == other.position

    def __hash__(self) -> int:
        """Hash based on position for use in sets and dicts."""
        return hash(self.position)

class MultiCriteriaAStar:
    """Multi-criteria A* algorithm for finding optimal pipeline routes."""

    def __init__(self, start: Tuple[float, float], goal: Tuple[float, float], 
                 terrain_analyzer: TerrainAnalyzer, pipe_diameter: float,
                 pipe_material: str, max_pressure: float, pipe_type: str,
                 criteria_weights: Dict[str, float]):
        """
        Initialize the A* algorithm.

        Args:
            start: Starting point (latitude, longitude)
            goal: Goal point (latitude, longitude)
            terrain_analyzer: Terrain analyzer instance
            pipe_diameter: Diameter of the pipe in mm
            pipe_material: Material of the pipe
            max_pressure: Maximum pressure in atm
            pipe_type: Type of pipeline (oil, gas, water)
            criteria_weights: Dictionary of weights for each criterion
        """
        self.start = start
        self.goal = goal
        self.terrain_analyzer = terrain_analyzer
        self.pipe_diameter = pipe_diameter
        self.pipe_material = pipe_material
        self.max_pressure = max_pressure
        self.pipe_type = pipe_type
        self.criteria_weights = criteria_weights

        # Constants
        self.grid_size = 0.0005  # Grid cell size in degrees (~50m)
        self.max_neighbors = 8  # Number of neighbors to consider (8 for all directions)
        self.max_iterations = 20000  # Increased maximum iterations

        # Cache for cost calculations
        self.terrain_cache = {}

        logger.info(f"Initialized MultiCriteriaAStar: start={start}, goal={goal}, pipe_type={pipe_type}")

    def calculate_h_score(self, position: Tuple[float, float]) -> float:
        """
        Calculate the heuristic score (h-score) for a position.
        Uses haversine distance as the base heuristic.

        Args:
            position: Current position (latitude, longitude)

        Returns:
            Estimated cost to goal
        """
        # Basic distance heuristic
        distance_to_goal = haversine_distance(position, self.goal)

        # Apply terrain-based heuristic modifier
        terrain_factor = self._get_terrain_factor(position)

        # Combined heuristic
        h_score = distance_to_goal * (1 + terrain_factor * 0.3)

        return h_score

    def _get_terrain_factor(self, position: Tuple[float, float]) -> float:
        """
        Get terrain difficulty factor for a position.

        Args:
            position: Position to evaluate (latitude, longitude)

        Returns:
            Terrain difficulty factor (0.0-1.0)
        """
        # Check if we have this in cache
        if position in self.terrain_cache:
            return self.terrain_cache[position]

        # Get terrain difficulty from analyzer
        terrain_difficulty = self.terrain_analyzer.get_terrain_difficulty(
            position[0], position[1]
        )

        # Cache and return
        self.terrain_cache[position] = terrain_difficulty
        return terrain_difficulty

    def get_neighbors(self, position: Tuple[float, float], grid_size: Optional[float] = None) -> List[Tuple[float, float]]:
        """
        Get neighboring grid cells for a position.

        Args:
            position: Current position (latitude, longitude)
            grid_size: Optional grid size to use. If None, use default grid size.

        Returns:
            List of neighboring positions
        """
        lat, lng = position
        neighbors = []

        # Use provided grid size or default
        step = self.grid_size
        if grid_size is not None:
            step = grid_size

        # Generate neighbors in 8 directions
        for dlat in [-step, 0, step]:
            for dlng in [-step, 0, step]:
                if dlat == 0 and dlng == 0:
                    continue  # Skip current position

                neighbor = (lat + dlat, lng + dlng)

                # Check if the neighbor is valid (e.g., not in restricted area)
                if self.terrain_analyzer.is_valid_position(neighbor[0], neighbor[1]):
                    neighbors.append(neighbor)
                else:
                    # Log forbidden area detection
                    logger.debug(f"Position {neighbor} is in a forbidden area")

                    # Even if restricted, if we're very close to the goal, allow the position
                    # This helps when goal is in a technically restricted area
                    if haversine_distance(neighbor, self.goal) < step * 3:
                        logger.debug(f"Allowing forbidden position {neighbor} because it's close to goal")
                        neighbors.append(neighbor)

        # If we're getting close to the goal, add it as a direct neighbor
        if haversine_distance(position, self.goal) < step * 4:
            if self.goal not in neighbors:
                neighbors.append(self.goal)

        return neighbors

    def calculate_edge_cost(self, current: Tuple[float, float], 
                           neighbor: Tuple[float, float]) -> Dict[str, float]:
        """
        Calculate the cost of moving from current to neighbor based on multiple criteria.

        Args:
            current: Current position (latitude, longitude)
            neighbor: Neighbor position (latitude, longitude)

        Returns:
            Dictionary of costs for each criterion
        """
        # Calculate base distance cost
        distance = haversine_distance(current, neighbor)

        # Get terrain difficulty for the neighbor
        terrain_difficulty = self._get_terrain_factor(neighbor)

        # Calculate environmental impact
        environmental_impact = calculate_environmental_impact(
            self.pipe_type, self.pipe_diameter, terrain_difficulty)

        # Calculate construction cost
        construction_cost = calculate_construction_cost(
            distance, self.pipe_diameter, self.pipe_material, 
            terrain_difficulty, self.pipe_type)

        # Calculate maintenance access difficulty (inverse of accessibility)
        accessibility = self.terrain_analyzer.get_accessibility(neighbor[0], neighbor[1])
        maintenance_access = 1.0 - accessibility  # Invert for cost (higher is worse)

        # Return multi-criteria costs
        return {
            'distance': distance,
            'terrain_difficulty': distance * (1 + terrain_difficulty),
            'environmental_impact': environmental_impact,
            'construction_cost': construction_cost,
            'maintenance_access': distance * (1 + maintenance_access)
        }

    def combine_costs(self, costs: Dict[str, float]) -> float:
        """
        Combine multiple cost criteria into a single value using weights.

        Args:
            costs: Dictionary of costs for each criterion

        Returns:
            Combined weighted cost
        """
        combined_cost = 0.0

        for criterion, weight in self.criteria_weights.items():
            if criterion in costs:
                combined_cost += costs[criterion] * weight

        return combined_cost

    def find_paths(self, num_alternatives: int = 2) -> List[Tuple[List[Tuple[float, float]], Dict[str, Any]]]:
        """
        Find optimal and alternative paths using multi-criteria A* algorithm.

        Args:
            num_alternatives: Number of alternative routes to generate

        Returns:
            List of tuples (path coordinates, metrics dictionary)
        """
        paths = []

        # Find main optimal path
        main_path, main_metrics = self._find_single_path()
        if main_path:
            paths.append((main_path, main_metrics))

            # Generate alternative paths by adjusting weights
            for i in range(num_alternatives):
                # Adjust weights for alternatives
                alt_weights = self._get_alternative_weights(i + 1)
                self.criteria_weights = alt_weights

                # Find alternative path
                alt_path, alt_metrics = self._find_single_path()
                if alt_path:
                    # Add alternative number to metrics
                    alt_metrics['alternative_num'] = i + 1
                    paths.append((alt_path, alt_metrics))

        return paths

    def _find_single_path(self) -> Tuple[List[Tuple[float, float]], Dict[str, Any]]:
        """
        Find a single optimal path using current weights.
        """
        logger.info(f"Starting path finding from {self.start} to {self.goal}")

        # Check straight-line distance
        direct_distance = haversine_distance(self.start, self.goal)

        # Strategy based on distance
        if direct_distance < 0.5:  # If closer than 500m, use direct path
            logger.info(f"Start and goal are very close ({direct_distance:.3f} km), providing direct path")
            # Create a simple path with start and goal
            start_node = Node(self.start, {'distance': 0.0, 'terrain_difficulty': 0.0, 
                                          'environmental_impact': 0.0, 'construction_cost': 0.0, 
                                          'maintenance_access': 0.0})
            goal_node = Node(self.goal, {
                'distance': direct_distance,
                'terrain_difficulty': direct_distance * (1 + self._get_terrain_factor(self.goal)),
                'environmental_impact': calculate_environmental_impact(
                    self.pipe_type, self.pipe_diameter, self._get_terrain_factor(self.goal)),
                'construction_cost': calculate_construction_cost(
                    direct_distance, self.pipe_diameter, self.pipe_material, 
                    self._get_terrain_factor(self.goal), self.pipe_type),
                'maintenance_access': direct_distance * (1 + (1.0 - self.terrain_analyzer.get_accessibility(
                    self.goal[0], self.goal[1])))
            }, start_node)
            return self._reconstruct_path(goal_node)
        elif direct_distance > 2.0:  # For distances over 2km, use adaptive approach
            logger.info(f"Long distance path ({direct_distance:.3f} km), using adaptive approach")
            return self._find_path_adaptive()

        # Initialize open and closed sets
        open_set = []
        closed_set: Set[Tuple[float, float]] = set()

        # Create start node with initial g_scores
        initial_g_scores = {
            'distance': 0.0,
            'terrain_difficulty': 0.0,
            'environmental_impact': 0.0,
            'construction_cost': 0.0,
            'maintenance_access': 0.0
        }
        start_node = Node(self.start, initial_g_scores)

        # Calculate initial f_score and add to open set
        start_node.f_score = self.calculate_h_score(self.start)
        heapq.heappush(open_set, start_node)

        # Keep track of nodes by position for faster lookup
        node_dict = {self.start: start_node}

        # Start A* algorithm
        iterations = 0

        # Dynamically adjust grid size if needed - start with smaller grid
        current_grid_size = self.grid_size

        while open_set and iterations < self.max_iterations:
            iterations += 1

            # Periodically log progress
            if iterations % 1000 == 0:
                logger.debug(f"Path finding iteration {iterations}, open set size: {len(open_set)}")

                # If we've been searching for a long time, try increasing grid size
                if iterations > 5000 and current_grid_size == self.grid_size:
                    logger.info(f"Increasing grid size for faster search at iteration {iterations}")
                    current_grid_size = self.grid_size * 2

            # Get node with lowest f_score
            current_node = heapq.heappop(open_set)
            current_pos = current_node.position

            # Check if we reached the goal or are close enough
            dist_to_goal = haversine_distance(current_pos, self.goal)
            if dist_to_goal < current_grid_size * 2:
                logger.info(f"Path found after {iterations} iterations (distance to goal: {dist_to_goal:.6f})")

                # Create final node at exact goal position
                final_edge_costs = self.calculate_edge_cost(current_pos, self.goal)
                final_g_scores = {}

                for criterion, cost in current_node.g_score.items():
                    final_g_scores[criterion] = cost + final_edge_costs[criterion]

                goal_node = Node(self.goal, final_g_scores, current_node)
                return self._reconstruct_path(goal_node)

            # Add to closed set
            closed_set.add(current_pos)

            # Explore neighbors
            for neighbor_pos in self.get_neighbors(current_pos, current_grid_size):
                # Skip if neighbor is already processed
                if neighbor_pos in closed_set:
                    continue

                # Calculate new g_scores for this neighbor
                edge_costs = self.calculate_edge_cost(current_pos, neighbor_pos)
                new_g_scores = {}

                for criterion, cost in current_node.g_score.items():
                    new_g_scores[criterion] = cost + edge_costs[criterion]

                # Create or update neighbor node
                if neighbor_pos not in node_dict:
                    neighbor_node = Node(neighbor_pos, new_g_scores, current_node)
                    combined_g = self.combine_costs(new_g_scores)
                    h_score = self.calculate_h_score(neighbor_pos)
                    neighbor_node.f_score = combined_g + h_score

                    heapq.heappush(open_set, neighbor_node)
                    node_dict[neighbor_pos] = neighbor_node
                else:
                    neighbor_node = node_dict[neighbor_pos]

                    # Check if this path is better based on combined cost
                    old_combined_g = self.combine_costs(neighbor_node.g_score)
                    new_combined_g = self.combine_costs(new_g_scores)

                    if new_combined_g < old_combined_g:
                        # Update the node with better path
                        neighbor_node.g_score = new_g_scores
                        neighbor_node.parent = current_node
                        neighbor_node.f_score = new_combined_g + self.calculate_h_score(neighbor_pos)

                        # Re-add to open set (will be properly sorted by heap)
                        if neighbor_node not in open_set:
                            heapq.heappush(open_set, neighbor_node)

        logger.warning(f"No path found after {iterations} iterations")
        return [], {"error": "Путь не найден. Возможно, требуется изменить параметры поиска."}

    def _find_path_adaptive(self) -> Tuple[List[Tuple[float, float]], Dict[str, Any]]:
        """
        Find path for long distances using an adaptive approach that considers terrain features.
        Divides the problem into smaller segments and applies terrain-aware routing.

        Returns:
            Tuple of (path coordinates, metrics dictionary)
        """
        # Calculate straight-line vector from start to goal
        start_lat, start_lng = self.start
        goal_lat, goal_lng = self.goal

        # Calculate the direct distance
        direct_distance = haversine_distance(self.start, self.goal)

        # Calculate the number of segments based on distance
        num_segments = min(max(int(direct_distance / 0.3), 5), 40)

        logger.info(f"Dividing long path into {num_segments} segments with terrain consideration")

        # Create initial waypoints along a direct path as a starting point
        initial_waypoints = []
        for i in range(num_segments + 1):
            ratio = i / num_segments
            waypoint = (
                start_lat + (goal_lat - start_lat) * ratio,
                start_lng + (goal_lng - start_lng) * ratio
            )
            initial_waypoints.append(waypoint)

        # Optimize waypoints based on terrain features
        optimized_waypoints = self._optimize_waypoints_for_terrain(initial_waypoints)

        # Process each segment and build complete path
        full_path = [self.start]  # Start with the first point

        # Initialize metrics
        total_metrics = {
            "distance": 0.0,
            "terrain_difficulty": 0.0,
            "environmental_impact": 0.0,
            "construction_cost": 0.0,
            "maintenance_access": 0.0
        }

        # Process each segment between optimized waypoints
        for i in range(1, len(optimized_waypoints)):
            segment_start = optimized_waypoints[i-1]
            segment_goal = optimized_waypoints[i]

            # Skip if identical
            if segment_start == segment_goal:
                continue

            logger.debug(f"Processing segment {i} from {segment_start} to {segment_goal}")

            # Calculate cost for this segment
            edge_costs = self.calculate_edge_cost(segment_start, segment_goal)

            # Add to metrics
            for key in total_metrics:
                total_metrics[key] += edge_costs[key]

            # Add waypoint to path (skip if same as last point)
            if segment_goal != full_path[-1]:
                full_path.append(segment_goal)

        # Calculate total distance of the final path
        total_distance = calculate_distance(full_path)

        # If we have a very long route, apply path smoothing
        if len(full_path) > 10:
            # Smart smoothing that preserves important terrain features
            smoothed_path = self._smooth_path(full_path)
            full_path = smoothed_path

        # Estimate construction time based on difficulty factors
        avg_terrain_factor = 0.0
        for point in full_path:
            avg_terrain_factor += self._get_terrain_factor(point)
        avg_terrain_factor /= len(full_path) if len(full_path) > 0 else 1.0

        construction_time = (total_distance / 1000) * (1 + avg_terrain_factor * 0.5)

        # Final metrics
        metrics = {
            "total_distance": total_distance,
            "estimated_cost": total_metrics["construction_cost"],
            "terrain_difficulty_score": total_metrics["terrain_difficulty"] / total_distance if total_distance > 0 else 0,
            "environmental_impact_score": total_metrics["environmental_impact"],
            "estimated_construction_time": round(construction_time, 1)
        }

        return full_path, metrics

    def _optimize_waypoints_for_terrain(self, waypoints: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """
        Optimize waypoints based on terrain features like roads, rivers, and mountains.

        Args:
            waypoints: Initial waypoints along a direct path

        Returns:
            Terrain-optimized waypoints
        """
        optimized = [waypoints[0]]  # Always keep the start point

        for i in range(1, len(waypoints) - 1):
            current = waypoints[i]

            # Sample points around the current waypoint to find better alternatives
            alternatives = []

            # The current waypoint is always an alternative
            alternatives.append((current, self._evaluate_point_suitability(current)))

            # Try points in different directions from the current point
            sample_radius = 0.002  # About 200m
            for angle in range(0, 360, 45):  # 8 directions
                rad_angle = math.radians(angle)
                alt_lat = current[0] + sample_radius * math.sin(rad_angle)
                alt_lng = current[1] + sample_radius * math.cos(rad_angle)
                alt_point = (alt_lat, alt_lng)

                # Evaluate this alternative
                suitability = self._evaluate_point_suitability(alt_point)
                alternatives.append((alt_point, suitability))

            # Choose the best alternative
            best_point, _ = max(alternatives, key=lambda x: x[1])

            # Only add if it's different from the last added point
            if best_point != optimized[-1]:
                optimized.append(best_point)

        # Always keep the end point
        if waypoints[-1] != optimized[-1]:
            optimized.append(waypoints[-1])

        return optimized

    def _evaluate_point_suitability(self, point: Tuple[float, float]) -> float:
        """
        Evaluate how suitable a point is for the pipeline path based on terrain features.
        Higher score means more suitable.

        Args:
            point: Coordinate point (lat, lng)

        Returns:
            Suitability score (0.0-1.0)
        """
        lat, lng = point
        base_score = 0.7  # Base suitability

        # Check if this is a valid position at all
        if not self.terrain_analyzer.is_valid_position(lat, lng):
            logger.debug(f"Invalid position during suitability evaluation: {point}")
            return 0.01  # Very low score for forbidden areas

        # Apply criteria weights for evaluation
        road_weight = self.criteria_weights.get('maintenance_access', 0.15) * 3.0
        water_weight = self.criteria_weights.get('terrain_difficulty', 0.2) * 3.0
        env_weight = self.criteria_weights.get('environmental_impact', 0.15) * 3.0
        cost_weight = self.criteria_weights.get('construction_cost', 0.2) * 3.0

        # Check for proximity to roads (bonus for being near roads)
        is_near_road, road_bonus = self.terrain_analyzer.near_road(lat, lng)
        if is_near_road:
            base_score += road_bonus * road_weight  # Bonus for being near roads (affected by maintenance_access weight)

        # Check for water crossings (penalty for crossing water)
        is_water, water_difficulty = self.terrain_analyzer.is_water_crossing(lat, lng)
        if is_water:
            base_score -= water_difficulty * water_weight  # Higher penalty for crossing rivers

        # Check for terrain difficulty
        terrain_difficulty = self.terrain_analyzer.get_terrain_difficulty(lat, lng)
        base_score -= terrain_difficulty * (water_weight + cost_weight)/2  # Penalty for difficult terrain

        # Check for protected areas (environmental penalty)
        is_protected, impact_factor = self.terrain_analyzer.is_protected_area(lat, lng)
        if is_protected:
            base_score -= impact_factor * env_weight  # Penalty for environmental impact

        # Check for settlements (avoid going through dense settlements)
        is_settlement, restriction_factor = self.terrain_analyzer.near_settlement(lat, lng)
        if is_settlement:
            base_score -= restriction_factor * env_weight

        # Log very low scores for debugging
        if base_score < 0.2:
            logger.debug(f"Very low suitability score {base_score:.3f} at {point}")

        # Ensure score is in valid range
        return max(0.01, min(base_score, 1.0))

    def _get_alternative_weights(self, i: int) -> Dict[str, float]:
        """Get adjusted weights for alternative path to force different route."""
        weights = self.criteria_weights.copy()

        if i == 1:
            # First alternative: prioritize terrain and environmental factors
            weights['terrain_difficulty'] = min(0.8, weights['terrain_difficulty'] * 2)
            weights['environmental_impact'] = min(0.8, weights['environmental_impact'] * 2)
            weights['distance'] = max(0.1, weights['distance'] * 0.5)
        elif i == 2:
            # Second alternative: prioritize distance and cost
            weights['distance'] = min(0.8, weights['distance'] * 2)
            weights['construction_cost'] = min(0.8, weights['construction_cost'] * 2)
            weights['environmental_impact'] = max(0.1, weights['environmental_impact'] * 0.5)

        # Normalize weights to sum to 1
        total = sum(weights.values())
        return {k: v/total for k, v in weights.items()}

    def _smooth_path(self, path: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """
        Smooth a path by removing unnecessary points while preserving important terrain features.

        Args:
            path: Original path

        Returns:
            Smoothed path
        """
        if len(path) <= 3:
            return path

        smoothed = [path[0]]  # Always keep start

        for i in range(1, len(path) - 1):
            prev = path[i-1]
            curr = path[i]
            next_pt = path[i+1]

            # Calculate angles to detect turns
            angle1 = math.atan2(curr[0] - prev[0], curr[1] - prev[1])
            angle2 = math.atan2(next_pt[0] - curr[0], next_pt[1] - curr[1])
            angle_diff = abs(angle1 - angle2)

            # Check terrain features at this point
            lat, lng = curr
            is_water, _ = self.terrain_analyzer.is_water_crossing(lat, lng)
            is_near_road, _ = self.terrain_analyzer.near_road(lat, lng)
            terrain_difficulty = self.terrain_analyzer.get_terrain_difficulty(lat, lng)

            # Keep point if:
            # 1. It's a significant turn OR
            # 2. It's a water crossing point OR
            # 3. It's a road access point OR
            # 4. It's a point with significant terrain difficulty OR
            # 5. It's far from neighboring points
            if (angle_diff > 0.2 or  # Significant turn
                is_water or  # Water crossing
                is_near_road or  # Road access
                terrain_difficulty > 0.6 or  # Difficult terrain
                haversine_distance(prev, curr) > 0.8):  # Distance threshold

                # Only add if not too close to the last added point
                if haversine_distance(smoothed[-1], curr) > 0.05:  # 50m minimum spacing
                    smoothed.append(curr)

        smoothed.append(path[-1])  # Always keep goal

        return smoothed

    # Пример метода, возвращающего метрики
    def calculate_metrics(full_path, total_metrics, total_distance, construction_time):
        metrics = {
            "total_distance": total_distance,
            "estimated_cost": total_metrics["construction_cost"],
            "terrain_difficulty_score": total_metrics["terrain_difficulty"] / total_distance if total_distance > 0 else 0,
            "environmental_impact_score": total_metrics["environmental_impact"],
            "estimated_construction_time": round(construction_time, 1) if construction_time else 0  # Значение по умолчанию
        }
        return metrics
    
    def _reconstruct_path(self, end_node: Node) -> Tuple[List[Tuple[float, float]], Dict[str, Any]]:
        """
        Reconstruct the path from the goal node back to the start.

        Args:
            end_node: Final node in the path

        Returns:
            Tuple of (path coordinates, metrics dictionary)
        """
        path = []
        current = end_node

        while current:
            path.append(current.position)
            current = current.parent

        # Reverse to get path from start to goal
        path.reverse()

        # Calculate metrics for the final path
        total_distance = calculate_distance(path)
        construction_cost = end_node.g_score.get('construction_cost', 0)
        terrain_difficulty = end_node.g_score.get('terrain_difficulty', 0)
        environmental_impact = end_node.g_score.get('environmental_impact', 0)

        try:
            # Estimate construction time (days) based on distance and terrain
            construction_time = (total_distance / 1000) * (1 + self._get_terrain_factor(self.goal) * 0.5)
        except (ZeroDivisionError, KeyError):
            construction_time = 0  # Значение по умолчанию при ошибке

        metrics = {
            "total_distance": total_distance,
            "estimated_cost": construction_cost,
            "terrain_difficulty_score": terrain_difficulty / total_distance if total_distance > 0 else 0,
            "environmental_impact_score": environmental_impact,
            "estimated_construction_time": round(construction_time, 1) if construction_time else 0
        }

        return path, metrics