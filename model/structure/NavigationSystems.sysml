package NavigationSystems {
    doc /*
     * The autonomous navigation "brain" (paper Sections 3.2, 3.6, 3.7, Figure 1):
     * the decision-making and action-taking system with its situational awareness,
     * collision avoidance (obstacle detection and map representation, global and
     * local path planning) and control (motion control, dynamic positioning)
     * subsystems, plus the virtual captain (ship state definition).
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import ShipDataItems::*;
    private import ShipPorts::*;
    private import ShipStates::*;

    // ------------------------------------------------------------------
    // Situational awareness
    // ------------------------------------------------------------------

    part def SituationalAwarenessModule {
        doc /*
         * Advanced sensor module that performs lookout duties: identifies, monitors
         * and forecasts threats and objects from the fused situation picture.
         */
        port pictureIn : ~SituationPicturePort;
        port pictureOut : SituationPicturePort;
    }

    // ------------------------------------------------------------------
    // Collision avoidance
    // ------------------------------------------------------------------

    part def ObstacleDetectionAndMapping {
        doc /*
         * Detects, classifies and tracks static and dynamic obstacles (e.g. CNN-based
         * target recognition) and maintains a 2D/3D map representation of the environment.
         */
        port pictureIn : ~SituationPicturePort;
        port mapOut : ObstacleMapPort;
    }

    part def GlobalPathPlanner {
        doc /*
         * Deliberative planner that computes the voyage route from origin to destination
         * around known static obstacles from charts, waypoints and planned speed, usually offline.
         */
        attribute algorithm : GlobalPlanningAlgorithm;
        port routeOut : RoutePort;
    }

    part def LocalPathGenerator {
        doc /*
         * Reactive planner that follows the global route and re-plans in real time around
         * detected obstacles, applying COLREGs, then issues desired heading and speed.
         */
        attribute algorithm : LocalPlanningAlgorithm;
        attribute minimumPassingDistance :> ISQ::length;
        port routeIn : ~RoutePort;
        port mapIn : ~ObstacleMapPort;
        port guidanceOut : GuidancePort;
    }

    part def CollisionAvoidanceSystem {
        doc /*
         * Assesses collision risk with static and moving obstacles and provides the course
         * and speed that avoid collision, grounding and stranding in line with COLREGs.
         * Hybrid path planning combines the global planner and the local path generator.
         */
        part obstacleDetection : ObstacleDetectionAndMapping;
        part globalPathPlanner : GlobalPathPlanner;
        part localPathGenerator : LocalPathGenerator;

        connect obstacleDetection.mapOut to localPathGenerator.mapIn;
        connect globalPathPlanner.routeOut to localPathGenerator.routeIn;
    }

    // ------------------------------------------------------------------
    // Control
    // ------------------------------------------------------------------

    part def MotionController {
        doc /*
         * Autopilot for trajectory tracking, path following, manoeuvring, steering and
         * heading control, compensating for ship dynamics and environmental disturbances.
         */
        attribute method : MotionControlMethod;
        port guidanceIn : ~GuidancePort;
        port commandOut : ActuatorCommandPort;
    }

    part def DynamicPositioningSystem {
        doc /*
         * Dynamic positioning (DP): holds position or heading automatically using propellers,
         * rudders and thrusters within the ship's kinematic and dynamic constraints.
         * Supports DoA 4 operation and berthing.
         */
        attribute positionHoldTolerance :> ISQ::length;
        port guidanceIn : ~GuidancePort;
        port commandOut : ActuatorCommandPort;
    }

    part def ControlSystem {
        doc /* Control subsystem: keeps the ship on the planned track at the commanded course and speed. */
        part motionController : MotionController;
        part dynamicPositioning : DynamicPositioningSystem;
    }

    // ------------------------------------------------------------------
    // Virtual captain and decision making
    // ------------------------------------------------------------------

    part def VirtualCaptain {
        doc /*
         * Ship state definition (SSD): the highest level in the ship. Determines the
         * current ship status and operation mode (autonomous or remote controlled) and
         * activates the failsafe/fallback strategy when connectivity is lost.
         */
        attribute mode : OperationMode;
        attribute degreeOfAutonomy : DegreeOfAutonomy;
        attribute connectivityAvailable : Boolean;
        port statusLink : ShipStatusPort;
        exhibit state operationMode : OperationModeStates;
    }

    part def DecisionMakingSystem {
        doc /*
         * Decision-making and action-taking system: the onboard computer and AI
         * (machine learning, deep learning) software that takes SA and CA data,
         * computes the best action and passes it to control.
         */
        part virtualCaptain : VirtualCaptain;
        part situationalAwareness : SituationalAwarenessModule;
        part collisionAvoidance : CollisionAvoidanceSystem;
        part control : ControlSystem;

        connect situationalAwareness.pictureOut to collisionAvoidance.obstacleDetection.pictureIn;
        connect collisionAvoidance.localPathGenerator.guidanceOut to control.motionController.guidanceIn;
        connect collisionAvoidance.localPathGenerator.guidanceOut to control.dynamicPositioning.guidanceIn;
    }

    part def AutonomousNavigationSystem {
        doc /* Autonomous navigation system: obstacle detection and avoidance, navigation, guidance and control. */
        part decisionMaking : DecisionMakingSystem;
    }
}
