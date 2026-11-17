package SensorSystems {
    doc /*
     * Navigational and situational awareness (SA) sensors of the MASS (paper
     * Section 3.3, Figure 2). Every sensor exposes a SensorDataPort towards
     * sensor fusion. Surface and subsurface sensors are grouped in a SensorSuite.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import ShipDataItems::*;
    private import ShipPorts::*;

    // ------------------------------------------------------------------
    // Abstract sensor hierarchy
    // ------------------------------------------------------------------

    abstract part def Sensor {
        doc /* Any onboard sensor. Subject to drift, noise and calibration errors, so its data is fused. */
        attribute updateRate :> ISQ::frequency;
        attribute isHealthy : Boolean;
        port dataOut : SensorDataPort;
    }

    abstract part def NavigationalSensor :> Sensor {
        doc /* Conventional navigational sensors still required on MASS (Section 3.3.1). */
    }

    abstract part def SituationalAwarenessSensor :> Sensor {
        doc /* Additional, redundant sensors that take over lookout duties on MASS (Section 3.3.2). */
    }

    abstract part def SubsurfaceSensor :> SituationalAwarenessSensor {
        doc /* Underwater sensors for depth sensing and imaging below the waterline. */
        attribute maxDepthRange :> ISQ::length;
    }

    // ------------------------------------------------------------------
    // Navigational sensors
    // ------------------------------------------------------------------

    part def GnssReceiver :> NavigationalSensor {
        doc /* GNSS receiver (GPS/DGPS): geo-spatial position, DGPS accuracy within 1-10 m. */
        attribute horizontalAccuracy :> ISQ::length;
        attribute isDifferential : Boolean;
    }

    part def InertialMeasurementUnit :> NavigationalSensor {
        doc /* IMU: tracks vessel motion (accelerations and rotation rates) for stability and collision avoidance. */
    }

    part def Radar :> NavigationalSensor {
        doc /* Radar: detects objects and provides range data. S/X band for open water, Ka/W band for harbours. */
        attribute band : RadarBand;
        attribute detectionRange :> ISQ::length;
    }

    part def AisTransceiver :> NavigationalSensor {
        doc /* AIS: ship-to-ship and ship-to-shore exchange of identity, navigation and voyage data. */
        port aisLink : AisPort;
    }

    part def Arpa :> NavigationalSensor {
        doc /* Automatic Radar Plotting Aid: tracks radar targets and computes COLREGs-compliant manoeuvres with AIS. */
    }

    part def Ecdis :> NavigationalSensor {
        doc /* Electronic Chart Display and Information System: integrates sensor data on real-time electronic charts. */
    }

    // ------------------------------------------------------------------
    // Surface situational awareness sensors
    // ------------------------------------------------------------------

    part def DayCamera :> SituationalAwarenessSensor {
        doc /* High-resolution colour camera for ships, obstacles and aids to navigation in daylight. */
        attribute horizontalFieldOfView : AngularMeasureValue;
    }

    part def InfraredCamera :> SituationalAwarenessSensor {
        doc /* LWIR (8-14 um, uncooled microbolometer) or SWIR camera for night, humid and foggy conditions. */
        attribute horizontalFieldOfView : AngularMeasureValue;
    }

    part def Lidar :> SituationalAwarenessSensor {
        doc /* LIDAR/LADAR: 3D point clouds for accurate distance measurement; degraded by fog, rain and snow. */
        attribute detectionRange :> ISQ::length;
    }

    part def AcousticSensor :> SituationalAwarenessSensor {
        doc /* Microphone array that detects, classifies and localises COLREGs sound signals (horns, whistles, bells). */
    }

    part def WeatherSensor :> SituationalAwarenessSensor {
        doc /* Anemometer and environmental sensors: wind, wave, current, temperature, pressure, humidity. */
    }

    part def NavtexReceiver :> SituationalAwarenessSensor {
        doc /* NAVTEX (GMDSS) receiver for global and local weather information used in weather routing. */
    }

    part def UnmannedAerialVehicle :> SituationalAwarenessSensor {
        doc /* Drone (compact VTOL UAV) scouting ahead of the MASS to widen situational awareness. */
    }

    // ------------------------------------------------------------------
    // Subsurface situational awareness sensors
    // ------------------------------------------------------------------

    part def Echosounder :> SubsurfaceSensor {
        doc /* Measures water depth below the keel. */
    }

    part def NavigationSonar :> SubsurfaceSensor {
        doc /* High-resolution forward-looking navigation sonar for underwater obstacles ahead. */
    }

    part def SideScanSonar :> SubsurfaceSensor {
        doc /* Side scan sonar for seabed imaging and bathymetry. */
    }

    part def UnmannedUnderwaterVehicle :> SubsurfaceSensor {
        doc /* UUV extending vision below the waterline, ahead of and around the MASS. */
    }

    // ------------------------------------------------------------------
    // Sensor suite
    // ------------------------------------------------------------------

    part def SensorSuite {
        doc /* All navigational, surface SA and subsurface SA sensors fitted to the MASS (Figure 2). */

        // Navigational sensors
        part gnss : GnssReceiver;
        part imu : InertialMeasurementUnit;
        part longRangeRadar : Radar;
        part shortRangeRadar : Radar;
        part ais : AisTransceiver;
        part arpa : Arpa;
        part ecdis : Ecdis;

        // Surface situational awareness
        part dayCameras : DayCamera[1..*];
        part infraredCameras : InfraredCamera[1..*];
        part lidar : Lidar;
        part acousticSensor : AcousticSensor;
        part weatherSensor : WeatherSensor;
        part navtex : NavtexReceiver;
        part drone : UnmannedAerialVehicle[0..1];

        // Subsurface situational awareness
        part echosounder : Echosounder;
        part navigationSonar : NavigationSonar;
        part sideScanSonar : SideScanSonar;
        part uuv : UnmannedUnderwaterVehicle[0..1];
    }
}
