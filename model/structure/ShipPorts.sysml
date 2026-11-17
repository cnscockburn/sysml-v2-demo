package ShipPorts {
    doc /*
     * Port and interface definitions for the MASS autonomous navigation architecture.
     * Directions are declared from the providing side; receivers use the conjugate (~).
     */

    private import ShipDataItems::*;

    port def SensorDataPort {
        doc /* Sensor output: raw measurements towards sensor fusion. */
        out item sensorData : SensorData;
    }

    port def SituationPicturePort {
        doc /* Fused situation picture from sensor fusion towards situational awareness. */
        out item picture : SituationPicture;
    }

    port def ObstacleMapPort {
        doc /* Obstacle map towards path planning. */
        out item obstacleMap : ObstacleMap;
    }

    port def RoutePort {
        doc /* Planned voyage route (global path). */
        out item route : Route;
    }

    port def GuidancePort {
        doc /* Desired heading and speed (local path) towards the control subsystem. */
        out item guidance : GuidanceReference;
    }

    port def ActuatorCommandPort {
        doc /* Rudder and thrust commands from control towards actuators. */
        out item command : ActuatorCommand;
    }

    port def MachineryCommandPort {
        doc /* Machinery set-points from actuators towards propulsion and steering machinery. */
        out item command : MachineryCommand;
    }

    port def MachineryStatusPort {
        doc /* Machinery health and state towards sensor fusion and monitoring. */
        out item machineryStatus : MachineryStatus;
    }

    port def PropulsiveEffortPort {
        doc /* Forces and moments delivered by machinery to the hull. */
        out item effort : PropulsiveEffort;
    }

    port def DisturbancePort {
        doc /* Environmental loads (wind, wave, current) acting on the vessel. */
        out item disturbance : EnvironmentalDisturbance;
    }

    port def DataStoragePort {
        doc /* Store voyage records into the database; retrieve stored records back. */
        out item stored : VoyageRecord;
        in item retrieved : VoyageRecord;
    }

    port def ShipStatusPort {
        doc /* Ship status out and remote commands in, between the decision-making system and communications or the RCC. */
        out item status : StatusReport;
        in item remoteCommand : RemoteCommand;
    }

    port def AisPort {
        doc /* AIS/VDES exchange: own report out, other ships' reports in. */
        out item ownReport : AisMessage;
        in item targetReport : AisMessage;
    }

    interface def RemoteControlInterface {
        doc /* Ship-to-shore link between the MASS communication system and a remote control centre. */
        end shipSide : ShipStatusPort;
        end shoreSide : ~ShipStatusPort;
        flow of StatusReport from shipSide.status to shoreSide.status;
        flow of RemoteCommand from shoreSide.remoteCommand to shipSide.remoteCommand;
    }

    interface def AisLinkInterface {
        doc /* Ship-to-ship AIS/VDES link sharing identity, position and route intentions. */
        end ownShip : AisPort;
        end otherShip : ~AisPort;
        flow of AisMessage from ownShip.ownReport to otherShip.ownReport;
        flow of AisMessage from otherShip.targetReport to ownShip.targetReport;
    }
}
