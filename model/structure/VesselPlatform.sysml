package VesselPlatform {
    doc /*
     * The vessel platform beneath the autonomous navigation system (paper Figure 1,
     * Sections 3.4, 3.5, 3.8): sensor fusion, internal database and VDR, actuators,
     * machinery (propulsion, steering, power), hull, communication and mooring.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import ShipDataItems::*;
    private import ShipPorts::*;

    part def SensorFusionUnit {
        doc /*
         * Data processing technology that merges radar, LIDAR, sonar, GNSS, camera and other
         * sensor data (e.g. deep neural networks, image segmentation, redundant data reduction)
         * into a best-perceived situation picture, and reduces data sent to the RCC.
         */
        port sensorIn : ~SensorDataPort;
        port machineryIn : ~MachineryStatusPort;
        port pictureOut : SituationPicturePort;
        port storage : DataStoragePort;
    }

    part def ShipDatabase {
        doc /*
         * Internal ship database storing sensor and voyage data for decision making, data
         * engineering (AI model training, path and energy optimisation) and big data platforms.
         */
        attribute storageCapacity :> ISQ::informationEntropy;
        port storage : ~DataStoragePort;
    }

    part def VoyageDataRecorder {
        doc /*
         * VDR: records positional, navigational and sensor data (radar, ECDIS, GNSS, audio-visual)
         * in a data aggregating unit and protected storage unit for accident investigation.
         */
        attribute recordingDuration :> ISQ::duration;
        port storage : ~DataStoragePort;
    }

    part def Actuators {
        doc /*
         * Actuators that execute control commands without human intervention (e.g. steering
         * pumps, fuel valves) and drive the machinery set-points.
         */
        port commandIn : ~ActuatorCommandPort;
        port machineryOut : MachineryCommandPort;
    }

    part def PropulsionUnit {
        doc /* Main propeller(s) and prime mover producing longitudinal thrust. */
        attribute maxThrust :> ISQ::force;
    }

    part def SteeringGear {
        doc /* Rudder and steering gear producing turning moment. */
        attribute maxRudderAngle : AngularMeasureValue;
    }

    part def Thruster {
        doc /* Tunnel or azimuth thruster used for low-speed manoeuvring, DP and berthing. */
        attribute maxThrust :> ISQ::force;
    }

    part def PowerSupply {
        doc /* Power and fuel supply for propulsion and ship systems (conventional, alternative fuel or electric). */
        attribute ratedPower :> ISQ::power;
    }

    part def Machinery {
        doc /* Propulsion, steering, thrusters and power: turns machinery set-points into forces on the hull. */
        part propulsion : PropulsionUnit[1..*];
        part steeringGear : SteeringGear[1..*];
        part thrusters : Thruster[0..*];
        part powerSupply : PowerSupply;
        port commandIn : ~MachineryCommandPort;
        port effortOut : PropulsiveEffortPort;
        port statusOut : MachineryStatusPort;
    }

    part def Hull {
        doc /* Hull and vessel dynamics: responds to propulsive effort and environmental disturbances to produce motion. */
        attribute lengthOverall :> ISQ::length;
        attribute beam :> ISQ::length;
        attribute displacementMass :> ISQ::mass;
        port effortIn : ~PropulsiveEffortPort;
        port disturbanceIn : ~DisturbancePort;
    }

    part def CommunicationSystem {
        doc /*
         * Ship-to-shore and ship-to-ship communication (satellite, VHF/VDES, e-navigation S-100
         * services) linking the MASS to the RCC, other ships, ports and other stakeholders.
         */
        port internalLink : ~ShipStatusPort;
        port shoreLink : ShipStatusPort;
    }

    part def MooringSystem {
        doc /* Automatic mooring equipment for autonomous or remote berthing and unberthing, supported by DP. */
        attribute isAutomatic : Boolean;
    }
}
