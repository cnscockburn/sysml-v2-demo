    port def SensorDataPort {
        doc /* Sensor output: raw measurements towards sensor fusion. */
        out item sensorData : SensorData;
    }

    port def SituationPicturePort {
        doc /* Fused situation picture from sensor fusion towards situational awareness. */
        out item picture : SituationPicture;
    }
