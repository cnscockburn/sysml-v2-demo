package OperationalContext {
    doc /*
     * External entities around the MASS (paper Figure 1 and Section 3.8): the remote
     * control centre (RCC) and its operators, other ships, ports and other stakeholders,
     * the onboard control team for berthing, and the maritime environment.
     */

    private import ScalarValues::*;
    private import ISQ::*;
    private import SI::*;
    private import ShipDataItems::*;
    private import ShipPorts::*;
    private import ShipArchitecture::*;

    part def RccOperator {
        doc /* Shore-based operator who monitors the MASS and can take remote control. */
    }

    part def ImmersiveDisplay {
        doc /* AR/VR display (headset, cave or curved wall) overlaying AI-labelled objects on the ship's surroundings. */
    }

    part def RemoteControlCentre {
        doc /* Remote control centre (shore control centre) that supervises and remotely operates one or more MASS. */
        part operators : RccOperator[1..*];
        part immersiveDisplay : ImmersiveDisplay[0..*];
        port shipLink : ~ShipStatusPort;
    }

    part def OtherShip {
        doc /* Another manned, remote-controlled or autonomous vessel encountered at sea. */
        attribute isAutonomous : Boolean;
        port aisLink : ~AisPort;
    }

    part def PortAuthority {
        doc /* Port, VTS and other shore stakeholders exchanging e-navigation information with the MASS. */
    }

    part def OnboardControlTeam {
        doc /* Crew that embarks during port approach and departure to assist berthing (MUNIN concept). */
    }

    part def MaritimeEnvironment {
        doc /* Wind, waves and currents disturbing the vessel, plus static hazards (coast, shoals, rocks). */
        attribute conditions : EnvironmentConditions;
        port disturbanceOut : DisturbancePort;
    }

    part def MassOperationalContext {
        doc /* The MASS in its operating context: linked to an RCC and other ships, disturbed by the environment. */
        part ship : AutonomousShip;
        part rcc : RemoteControlCentre;
        part otherShips : OtherShip[0..*];
        part portAuthority : PortAuthority;
        part onboardControlTeam : OnboardControlTeam[0..1];
        part environment : MaritimeEnvironment;

        interface remoteControlLink : RemoteControlInterface connect ship.communication.shoreLink to rcc.shipLink;
        interface aisLink : AisLinkInterface connect ship.sensors.ais.aisLink to otherShips.aisLink;
        connect environment.disturbanceOut to ship.hull.disturbanceIn;
    }
}
