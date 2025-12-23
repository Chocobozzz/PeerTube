# 9ten - A Decentralized Music Streaming Platform

## Introduction and Vision

**Purpose**
9ten is a decentralized music streaming platform leveraging peer-to-peer data sharing technologies and the W3C ActivityPub protocol to create a social network for artists and fans. The platform enables listeners to pay an optional monthly subscription fee, fairly distributed to their top 9 most-listened-to artists each month.

**Vision Statement**
To revolutionize the music streaming industry by fostering a fair, transparent, and decentralized ecosystem that empowers artists and engages listeners. Our goal is to create a platform where the needs and rights of artists and listeners take precedence over large conglomerates.

## Core Principles

1. **Fair Compensation**
2. **Decentralization of Power**
3. **Transparency in Operations**
4. **Artist Empowerment**
5. **Listener Engagement**
6. **Responsive to Community Needs**

## Stakeholder Overview

### Roles and Responsibilities
- **Developers**: Implement and maintain the technical aspects of the platform, including ActivityPub integration and Hyperledger Fabric setup.
- **Artists**: Upload music, engage with fans, and manage earnings.
- **Server Admins**: Set up and manage 9ten server instances, ensuring data integrity and reporting.
- **Listeners**: Use the platform to stream music, support artists, and interact with content.

### Stakeholder Benefits
- **Developers**: Opportunity to work on cutting-edge technologies and contribute to an innovative project.
- **Artists**: Fair compensation, direct engagement with fans, and control over their content.
- **Server Admins**: Regular revenue from listener subscriptions and control over their instances.
- **Listeners**: Directly support favorite artists and enjoy high-quality, decentralized streaming.

## Technical Overview

### Architecture Diagram
Provide a high-level architecture diagram showing the interaction between various components (ActivityPub servers, Hyperledger Fabric nodes, client applications, etc.).

### Data Flow Diagram
Illustrate the data flow from the point a user listens to a track, to how data is logged, verified, and payments are distributed.

## Detailed Technical Implementation

### Extending ActivityPub for Streaming
#### Forking PeerTube
1. **Adapt for Audio**: Modify the codebase to support audio streaming, ensuring efficient handling of audio files.
2. **Custom Activities**: Define new ActivityPub activities for music-specific interactions:
   - `ListenActivity`: Represents a user listening to a track.
   - `StreamActivity`: Represents live streaming events.
   - `SubscriptionActivity`: Represents subscribing to an artist or node.
3. **Custom Objects**: Create new objects to represent musical content:
   - `AudioTrack`: Includes metadata like artist, album, duration, etc.
   - `Playlist`: User-curated lists of audio tracks.

#### ActivityPub API Extensions
Extend the API endpoints to handle new activities and objects, ensuring compliance with the protocol.

### Integrating Hyperledger for Transactions
#### Hyperledger Fabric Setup
1. **Deploy Hyperledger Nodes**: Each ActivityPub server also runs a Hyperledger Fabric node.
2. **Chaincode Development**:
   - **Subscription Payments**: Logic for subscription payments, ensuring $1 goes to node operators and $9 is pooled for artists.
   - **Streaming Rewards**: Distribute funds to artists based on verified streaming data.
   - **Transaction Verification**: Ensure all transactions are verified and recorded on the ledger.

#### Data Flow
- **Payment Handling**: Payments are processed through listeners' digital wallets, interfaced with Hyperledger Fabric.
- **Streaming Data**: Nodes collect streaming data and report it to the ledger for data integrity and transparency.

flowchart TD
    %% Define Styles
    classDef blockchain fill:#f9f,stroke:#333,stroke-width:2px;
    classDef p2p fill:#ade,stroke:#333,stroke-width:2px;
    classDef actor fill:#ffd,stroke:#333,stroke-width:2px;
    classDef storage fill:#eee,stroke:#333,stroke-width:2px;

    %% Actors
    Listener((Listener)):::actor
    Artist((Artist)):::actor
    Operator((Node Operator)):::actor

    subgraph User_Space [User Environment]
        Wallet[User Crypto Wallet]
        Client[9ten Client App]
    end

    subgraph Public_Chain [Public Blockchain (Polygon/Eth)]
        SC[Split-Payment Smart Contract]:::blockchain
        Vault[Artist Payout Vault]:::blockchain
    end

    subgraph 9ten_Network [9ten Decentralized Network]
        Node[Local 9ten Node / Oracle]:::p2p
        Witness[Witness Node]:::p2p
        HL[(Hyperledger Fabric Ledger)]:::storage
    end

    %% --- FLOW 1: SUBSCRIPTION ---
    Listener -->|1. Pay $10 USDP| Wallet
    Wallet -->|2. Transfer USDP| SC
    SC -->|3a. Instant $1 Op Fee| Operator
    SC -->|3b. Lock $9 Pool| Vault
    SC -.->|4. Emit Event: SubVerified| Node
    Node -->|5. Grant Premium Access| HL

    %% --- FLOW 2: STREAMING & VERIFICATION (Three Eyes) ---
    Listener -->|6. Press Play| Client
    Client -->|7. Request Audio| Node
    Node -->|8. Stream Audio Data| Client
    Client -->|9. Report ListenActivity| Node
    Node -->|10. Verify Bandwidth & Sign| Witness
    Witness -->|11. Verify Signature| HL
    Node -->|12. Commit Verified Stream| HL

    %% --- FLOW 3: MONTHLY PAYOUT ---
    HL -->|13. Calculate Top 9 (Equal Split)| Node
    Node -->|14. Submit PayoutManifest| SC
    SC -->|15. Unlock Funds| Vault
    Vault -->|16. Direct Transfer| Artist

## Effective Dispute Resolution Mechanism

### Dispute Detection
Implement automated systems to detect anomalies in streaming data.

### Three Eyes Policy
1. **Verification Process**: Disputes are reviewed by the local node, a peer within the cluster, and an external node.
2. **Resolution Workflow**:
   - **Flagging Discrepancies**: Automatically flag potential disputes.
   - **Manual Review**: Nodes perform manual reviews, consulting with other nodes as needed.
   - **Third-Party Arbitration**: A node from another cluster can arbitrate using detailed logs and data.

### Consensus and Documentation
1. **Achieve Consensus**: Ensure all parties agree on the resolution.
2. **Record Keeping**: Document all disputes, resolutions, and arbitration outcomes for transparency and audits.

## Payment Handling and Subscription Management

### Listener Subscription Payments
Listeners pay $10 USD equivalent in USDP to their local node’s wallet. Payments handled externally through cryptocurrency wallets or payment gateways.

### Initial Distribution of Funds
$1 to node operators on the 1st of each month for operational costs. $9 pooled for artist payouts, distributed by the 25th based on verified streaming data.

### Subscription Management
1. **Managed through secure payment gateways.**
2. **Smart contracts record subscription details, ensuring continuous service.**
3. **Multi-node verification ensures transaction validity and updates the ledger.**
4. **Automated renewals and expirations handled through the system.**

## Reporting

### Daily Listening Reports
1. **Capture detailed streaming data, aggregated daily at node level.**
2. **Automated anomaly detection for potential data issues.**
3. **Data anonymized and encrypted for privacy and security.**

### Monthly Listening Report Reconciliation
1. **Compile daily reports into a comprehensive monthly report.**
2. **Internal and peer reviews ensure data accuracy.**
3. **Automated dispute resolution protocol for discrepancies.**
4. **Verified data used for calculating artist payouts through smart contracts.**
5. **Maintain comprehensive records for audits and regulatory compliance.**

## Non-Technical Aspects

### Community and Governance
1. **Community Guidelines**: Establish guidelines for community interaction and contribution.
2. **Governance Model**: Define how decisions are made, who has voting rights, and how conflicts are resolved.

### Marketing and Outreach
1. **Strategy**: Outline strategies to attract early artists and listeners.
2. **Partnerships**: Potential partnerships with music schools, indie artist collectives, and other music industry entities.

## Security and Privacy

### Data Privacy
Describe how user data is protected and anonymized.

### Security Measures
Outline the security protocols for transaction handling, data storage, and communication.

## Roadmap and Milestones

### Development Roadmap
Provide a timeline for development phases, including major milestones.

### Release Plan
Plan for alpha, beta, and public release, including testing and feedback loops.

### Metrics for Success
Define key performance indicators (KPIs) to measure progress.

## Appendices

### Glossary
Define key terms and acronyms used in the document.

### References
Include references to technical resources, standards, and external documentation.

### Frequently Asked Questions (FAQ)
Address common questions that stakeholders might have.
