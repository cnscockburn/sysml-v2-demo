
    requirement def <'SA-001'> PositionAccuracyRequirement {
        doc /* The ship shall determine its own position with a horizontal accuracy no worse than the required maximum. */
        subject ship : AutonomousShip;
        attribute positionAccuracyMax :> ISQ::length;
        require constraint { ship.positionAccuracy <= positionAccuracyMax }
    }
