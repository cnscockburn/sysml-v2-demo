package AutonomousNavigation {
    doc /*
     * The autonomous navigation perception-action cycle (paper Section 3.1, Figure 1):
     * sense, fuse, assess, detect obstacles and map, plan, generate the local path,
     * control motion, actuate and record, repeated until the voyage is complete.
     */

    private import ScalarValues::*;
    private import ShipDataItems::*;

    action def SenseEnvironment {
        doc /* Acquire own-ship, environment and target data from navigational and SA sensors. */
        out item sensorData : SensorData;
    }

    action def FuseSensorData {
        doc /* Merge redundant and conflicting sensor data into a best-perceived situation picture. */
        in item sensorData : SensorData;
        out item picture : SituationPicture;
    }

    action def AssessSituation {
        doc /* Identify, monitor and forecast threats and objects in the situation picture (lookout duty). */
        in item picture : SituationPicture;
        out item assessedPicture : SituationPicture;
    }

    action def DetectObstaclesAndMap {
        doc /* Detect, classify and track static and dynamic obstacles and update the map representation. */
        in item picture : SituationPicture;
        out item obstacleMap : ObstacleMap;
    }

    action def PlanGlobalPath {
        doc /* Compute the voyage route from origin to destination around known static obstacles. */
        in attribute destination : GeoPosition;
        out item route : Route;
    }

    action def GenerateLocalPath {
        doc /* Re-plan reactively around detected obstacles in line with COLREGs and output desired heading and speed. */
        in item route : Route;
        in item obstacleMap : ObstacleMap;
        out item guidance : GuidanceReference;
    }

    action def ControlMotion {
        doc /* Track the trajectory: convert desired heading and speed into rudder and thrust commands. */
        in item guidance : GuidanceReference;
        out item command : ActuatorCommand;
    }

    action def ExecuteActuation {
        doc /* Apply actuator commands to propulsion, steering and thrusters. */
        in item command : ActuatorCommand;
        out item effort : PropulsiveEffort;
    }

    action def RecordVoyageData {
        doc /* Store the situation picture in the internal database and VDR. */
        in item picture : SituationPicture;
    }

    action def NavigateAutonomously {
        doc /*
         * One autonomous voyage: plan the global route once, then run the perception-action
         * cycle until the destination is reached.
         */
        in attribute destination : GeoPosition;
        attribute voyageComplete : Boolean;

        action planGlobalPath : PlanGlobalPath;
        action senseEnvironment : SenseEnvironment;
        action fuseSensorData : FuseSensorData;
        action recordVoyageData : RecordVoyageData;
        action assessSituation : AssessSituation;
        action detectObstaclesAndMap : DetectObstaclesAndMap;
        action generateLocalPath : GenerateLocalPath;
        action controlMotion : ControlMotion;
        action executeActuation : ExecuteActuation;

        first start;
        then planGlobalPath;
        then senseEnvironment;
        then fuseSensorData;
        then recordVoyageData;
        then assessSituation;
        then detectObstaclesAndMap;
        then generateLocalPath;
        then controlMotion;
        then executeActuation;
        then decide checkArrival;
            if voyageComplete then done;
            else senseEnvironment;

        flow destination to planGlobalPath.destination;
        flow senseEnvironment.sensorData to fuseSensorData.sensorData;
        flow fuseSensorData.picture to recordVoyageData.picture;
        flow fuseSensorData.picture to assessSituation.picture;
        flow assessSituation.assessedPicture to detectObstaclesAndMap.picture;
        flow planGlobalPath.route to generateLocalPath.route;
        flow detectObstaclesAndMap.obstacleMap to generateLocalPath.obstacleMap;
        flow generateLocalPath.guidance to controlMotion.guidance;
        flow controlMotion.command to executeActuation.command;
    }

    action def BerthVessel {
        doc /*
         * Berthing (mooring) supported by dynamic positioning. Until autonomous berthing is
         * solved, an onboard control team embarks on port approach to assist.
         */
        action embarkControlTeam;
        action approachBerthUnderDp;
        action secureMooringLines;

        first start;
        then embarkControlTeam;
        then approachBerthUnderDp;
        then secureMooringLines;
        then done;
    }

    action def UnberthVessel {
        doc /* Unberthing (unmooring): release lines, leave the berth under DP and disembark the control team. */
        action releaseMooringLines;
        action departBerthUnderDp;
        action disembarkControlTeam;

        first start;
        then releaseMooringLines;
        then departBerthUnderDp;
        then disembarkControlTeam;
        then done;
    }
}
