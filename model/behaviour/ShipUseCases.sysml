package ShipUseCases {
    doc /* Use cases of the MASS with the RCC, other ships, ports and the onboard control team as actors. */

    private import ShipArchitecture::*;
    private import OperationalContext::*;

    use case def ConductAutonomousVoyage {
        doc /* Sail from origin berth to destination berth autonomously under RCC supervision. */
        subject ship : AutonomousShip;
        actor rcc : RemoteControlCentre;
        actor portAuthority : PortAuthority;
        objective {
            doc /* Deliver the voyage safely and efficiently without collision, grounding or stranding. */
        }

        include use case unberth : UnberthShip;
        include use case avoidCollision : AvoidCollision;
        include use case superviseRemotely : SuperviseRemotely;
        include use case handleConnectivityLoss : HandleConnectivityLoss;
        include use case berth : BerthShip;
    }

    use case def AvoidCollision {
        doc /* Detect static and dynamic obstacles and manoeuvre in line with COLREGs. */
        subject ship : AutonomousShip;
        actor otherShip : OtherShip;
        objective {
            doc /* Keep the predicted CPA above the minimum passing distance with COLREGs-compliant actions. */
        }
    }

    use case def SuperviseRemotely {
        doc /* RCC operators monitor the ship and take remote control when needed. */
        subject ship : AutonomousShip;
        actor rcc : RemoteControlCentre;
        objective {
            doc /* Keep a human in the loop and allow intervention at DoA 2-4. */
        }
    }

    use case def HandleConnectivityLoss {
        doc /* Bring the ship to a safe condition when the RCC link drops during an operational challenge. */
        subject ship : AutonomousShip;
        actor rcc : RemoteControlCentre;
        objective {
            doc /* Execute the failsafe/fallback sequence until the ship is safe or control is restored. */
        }
    }

    use case def BerthShip {
        doc /* Moor the ship at the berth using DP, assisted by the onboard control team. */
        subject ship : AutonomousShip;
        actor onboardControlTeam : OnboardControlTeam;
        actor portAuthority : PortAuthority;
        objective {
            doc /* Bring the ship alongside and secure it without contact damage. */
        }
    }

    use case def UnberthShip {
        doc /* Release the ship from the berth and depart the port approach. */
        subject ship : AutonomousShip;
        actor onboardControlTeam : OnboardControlTeam;
        actor portAuthority : PortAuthority;
        objective {
            doc /* Leave the berth safely and hand over to autonomous transit. */
        }
    }
}
