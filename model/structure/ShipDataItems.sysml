package ShipDataItems {
    doc /*
     * Data types, enumerations and items exchanged inside the MASS autonomous
     * navigation architecture: sensor data, the fused situation picture, obstacle
     * maps, routes, guidance and actuator commands, and ship-shore messages.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;

    // ------------------------------------------------------------------
    // Enumerations
    // ------------------------------------------------------------------

    enum def DegreeOfAutonomy {
        doc /*
         * IMO degrees of autonomy (DoA). doa1: automated processes with seafarers
         * on board; doa2: remotely controlled with seafarers on board; doa3:
         * remotely controlled without seafarers on board; doa4: fully autonomous.
         */
        doa1;
        doa2;
        doa3;
        doa4;
    }

    enum def OperationMode {
        doc /* Operation mode set by the virtual captain (ship state definition). */
        onboardManual;
        remoteControlled;
        autonomous;
        failsafe;
    }

    enum def ObstacleKind {
        doc /* Static obstacles (terrain, shallows, buoys) versus dynamic obstacles (other vessels). */
        stationary;
        moving;
    }

    enum def EncounterType {
        doc /* COLREGs Part B encounter situations handled by collision avoidance. */
        noRisk;
        headOn;
        crossingGiveWay;
        crossingStandOn;
        overtaking;
    }

    enum def RadarBand {
        doc /* Radar frequency bands: S/X for long range, Ka/W for short range in harbours. */
        sBand;
        xBand;
        kaBand;
        wBand;
    }

    enum def GlobalPlanningAlgorithm {
        doc /* Global (deliberative) path planning algorithm families reviewed in the paper (Table 3). */
        aStar;
        antColonyOptimisation;
        geneticAlgorithm;
        particleSwarmOptimisation;
        fastMarchingSquare;
        probabilisticRoadmap;
        rapidlyExploringRandomTree;
    }

    enum def LocalPlanningAlgorithm {
        doc /* Local (reactive) path planning algorithm families reviewed in the paper (Table 4). */
        artificialPotentialField;
        velocityObstacle;
        dynamicWindow;
        modelPredictiveControl;
        lineOfSightGuidance;
        deepReinforcementLearning;
    }

    enum def MotionControlMethod {
        doc /* Motion control and path following methods reviewed in the paper (Table 6). */
        pidControl;
        adaptiveFuzzyControl;
        slidingModeControl;
        backstepping;
        modelPredictiveControl;
        neuralNetworkControl;
    }

    // ------------------------------------------------------------------
    // Attribute (value) types
    // ------------------------------------------------------------------

    attribute def GeoPosition {
        doc /* A geographic position as latitude and longitude. */
        attribute latitude : AngularMeasureValue;
        attribute longitude : AngularMeasureValue;
    }

    attribute def ShipState {
        doc /* Own-ship kinematic state: position, speed over ground, heading and rate of turn. */
        attribute position : GeoPosition;
        attribute speedOverGround : SpeedValue;
        attribute heading : AngularMeasureValue;
        attribute rateOfTurn : AngularVelocityValue;
    }

    attribute def Waypoint {
        doc /* A route waypoint with its planned speed. */
        attribute position : GeoPosition;
        attribute plannedSpeed : SpeedValue;
    }

    attribute def EnvironmentConditions {
        doc /* Wind, current and wave conditions acting on the vessel. */
        attribute windSpeed : SpeedValue;
        attribute windDirection : AngularMeasureValue;
        attribute currentSpeed : SpeedValue;
        attribute currentDirection : AngularMeasureValue;
        attribute significantWaveHeight :> ISQ::length;
    }

    // ------------------------------------------------------------------
    // Items (things that flow through ports)
    // ------------------------------------------------------------------

    item def SensorData {
        doc /* Raw measurement produced by any navigational or situational awareness sensor. */
        attribute timestamp : String;
        attribute sourceId : String;
    }

    item def NavigationData :> SensorData {
        doc /* Own-ship position, motion and heading data (GNSS, IMU). */
        attribute ownState : ShipState;
    }

    item def TargetData :> SensorData {
        doc /* Detected target data: range, bearing and, where available, identity (radar, AIS, ARPA). */
        attribute range :> ISQ::length;
        attribute bearing : AngularMeasureValue;
        attribute targetSpeed : SpeedValue;
    }

    item def ImageData :> SensorData {
        doc /* Camera or LIDAR imagery and point clouds. */
    }

    item def AcousticData :> SensorData {
        doc /* Sound signals (horns, whistles, bells) with source type and direction of arrival. */
        attribute directionOfArrival : AngularMeasureValue;
    }

    item def EnvironmentData :> SensorData {
        doc /* Measured weather and sea conditions (anemometer, NAVTEX, wave and current sensors). */
        attribute conditions : EnvironmentConditions;
    }

    item def DepthData :> SensorData {
        doc /* Water depth and seabed imagery from echosounder and sonars. */
        attribute depthBelowKeel :> ISQ::length;
    }

    item def Obstacle {
        doc /* A static or dynamic obstacle with its kinematics, used to predict its future position. */
        attribute kind : ObstacleKind;
        attribute position : GeoPosition;
        attribute obstacleSpeed : SpeedValue;
        attribute course : AngularMeasureValue;
    }

    item def SituationPicture {
        doc /* Fused, best-perceived truth of own ship, environment and surroundings from sensor fusion. */
        attribute ownState : ShipState;
        attribute environment : EnvironmentConditions;
        item obstacles : Obstacle[*];
    }

    item def ObstacleMap {
        doc /* 2D/3D map representation of static and dynamic obstacles (e.g. occupancy grid, Voronoi map). */
        item obstacles : Obstacle[*];
        attribute encounter : EncounterType;
    }

    item def Route {
        doc /* Voyage plan from origin to destination as an ordered list of waypoints. */
        attribute waypoints : Waypoint[*] ordered;
    }

    item def GuidanceReference {
        doc /* Desired course and speed (local path) handed to the control subsystem. */
        attribute desiredHeading : AngularMeasureValue;
        attribute desiredSpeed : SpeedValue;
    }

    item def ActuatorCommand {
        doc /* Command from the control subsystem to the actuators: rudder angle and thrust demand. */
        attribute rudderAngle : AngularMeasureValue;
        attribute thrustDemand :> ISQ::force;
    }

    item def MachineryCommand {
        doc /* Set-points applied by actuators to propulsion, steering and power machinery. */
        attribute propellerSpeed : AngularVelocityValue;
        attribute rudderAngle : AngularMeasureValue;
    }

    item def PropulsiveEffort {
        doc /* Forces and moments produced by propellers, rudders and thrusters on the hull. */
        attribute surgeForce :> ISQ::force;
        attribute swayForce :> ISQ::force;
        attribute yawMoment :> ISQ::torque;
    }

    item def EnvironmentalDisturbance {
        doc /* Wind, wave and current loads acting on the vessel. */
        attribute conditions : EnvironmentConditions;
    }

    item def MachineryStatus {
        doc /* Health and state of propulsion, steering and power machinery. */
        attribute isAvailable : Boolean;
    }

    item def VoyageRecord {
        doc /* Stored positional, navigational and sensor data (internal database and VDR). */
        attribute timestamp : String;
    }

    item def StatusReport {
        doc /* Ship status sent to the RCC: state, operation mode and alarms. */
        attribute ownState : ShipState;
        attribute mode : OperationMode;
    }

    item def RemoteCommand {
        doc /* Command from an RCC operator, e.g. take manual control or change route. */
        attribute requestedMode : OperationMode;
    }

    item def AisMessage {
        doc /* AIS / VDES message carrying vessel identity, position, course, speed and route intentions. */
        attribute mmsi : String;
        attribute reportedState : ShipState;
    }
}
