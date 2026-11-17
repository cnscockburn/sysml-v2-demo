package ShipArchitecture {
    doc /*
     * The assembled MASS (paper Figure 1): the autonomous navigation system on top of
     * the vessel platform, with all internal data, command and effort connections.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import ShipDataItems::*;
    private import ShipPorts::*;
    private import SensorSystems::*;
    private import NavigationSystems::*;
    private import VesselPlatform::*;
    private import AutonomousNavigation::*;
    private import ShipStates::*;

    part def AutonomousShip {
        doc /*
         * Maritime Autonomous Surface Ship. Sensors feed sensor fusion; the fused picture
         * drives situational awareness and collision avoidance; control commands go through
         * actuators to machinery, which moves the hull. Data are stored in the database and
         * VDR; the virtual captain reports to the RCC through the communication system.
         */

        attribute degreeOfAutonomy : DegreeOfAutonomy;
        attribute serviceSpeed : SpeedValue;
        attribute positionAccuracy :> ISQ::length;
        attribute cameraCoverage : AngularMeasureValue;
        attribute minimumPassingDistance :> ISQ::length;
        attribute maxCrossTrackError :> ISQ::length;
        attribute dpPositionHoldTolerance :> ISQ::length;
        attribute vdrRecordingDuration :> ISQ::duration;
        attribute obstacleDetectionRange :> ISQ::length;
        attribute minimumUnderKeelClearance :> ISQ::length;

        // Behaviour
        perform action navigateAutonomously : NavigateAutonomously;
        perform action berthVessel : BerthVessel;
        perform action unberthVessel : UnberthVessel;
        exhibit state voyagePhase : VoyagePhaseStates;

        // Autonomous navigation
        part navigationSystem : AutonomousNavigationSystem {
            perform navigateAutonomously.assessSituation;
            perform navigateAutonomously.detectObstaclesAndMap;
            perform navigateAutonomously.planGlobalPath;
            perform navigateAutonomously.generateLocalPath;
            perform navigateAutonomously.controlMotion;
        }

        // Vessel platform
        part sensors : SensorSuite {
            perform navigateAutonomously.senseEnvironment;
        }
        part sensorFusion : SensorFusionUnit {
            perform navigateAutonomously.fuseSensorData;
        }
        part database : ShipDatabase;
        part vdr : VoyageDataRecorder {
            perform navigateAutonomously.recordVoyageData;
        }
        part actuators : Actuators {
            perform navigateAutonomously.executeActuation;
        }
        part machinery : Machinery;
        part hull : Hull;
        part communication : CommunicationSystem;
        part mooring : MooringSystem;

        // Sensors -> sensor fusion
        connect sensors.gnss.dataOut to sensorFusion.sensorIn;
        connect sensors.imu.dataOut to sensorFusion.sensorIn;
        connect sensors.longRangeRadar.dataOut to sensorFusion.sensorIn;
        connect sensors.shortRangeRadar.dataOut to sensorFusion.sensorIn;
        connect sensors.ais.dataOut to sensorFusion.sensorIn;
        connect sensors.arpa.dataOut to sensorFusion.sensorIn;
        connect sensors.ecdis.dataOut to sensorFusion.sensorIn;
        connect sensors.dayCameras.dataOut to sensorFusion.sensorIn;
        connect sensors.infraredCameras.dataOut to sensorFusion.sensorIn;
        connect sensors.lidar.dataOut to sensorFusion.sensorIn;
        connect sensors.acousticSensor.dataOut to sensorFusion.sensorIn;
        connect sensors.weatherSensor.dataOut to sensorFusion.sensorIn;
        connect sensors.navtex.dataOut to sensorFusion.sensorIn;
        connect sensors.drone.dataOut to sensorFusion.sensorIn;
        connect sensors.echosounder.dataOut to sensorFusion.sensorIn;
        connect sensors.navigationSonar.dataOut to sensorFusion.sensorIn;
        connect sensors.sideScanSonar.dataOut to sensorFusion.sensorIn;
        connect sensors.uuv.dataOut to sensorFusion.sensorIn;

        // Sensor fusion <-> storage
        connect sensorFusion.storage to database.storage;
        connect sensorFusion.storage to vdr.storage;

        // Machinery state feeds sensor fusion
        connect machinery.statusOut to sensorFusion.machineryIn;

        // Fused picture -> situational awareness
        connect sensorFusion.pictureOut to navigationSystem.decisionMaking.situationalAwareness.pictureIn;

        // Control -> actuators -> machinery -> hull
        connect navigationSystem.decisionMaking.control.motionController.commandOut to actuators.commandIn;
        connect navigationSystem.decisionMaking.control.dynamicPositioning.commandOut to actuators.commandIn;
        connect actuators.machineryOut to machinery.commandIn;
        connect machinery.effortOut to hull.effortIn;

        // Virtual captain <-> communication
        connect navigationSystem.decisionMaking.virtualCaptain.statusLink to communication.internalLink;
    }
}
