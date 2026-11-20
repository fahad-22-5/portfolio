// All site content lives here so copy edits never touch layout code.
// Engineering leads; the client-facing delivery work runs alongside it.

export const profile = {
  name: 'Fahad Eqbal Hashmi',
  short: 'FEH',
  role: 'Software Engineer',
  location: 'Noida, India',
  email: 'eqbalfahad@gmail.com',
  linkedin: 'https://www.linkedin.com/in/fahadeqbalhashmi',
  linkedinHandle: 'fahadeqbalhashmi',
};

export const stats = [
  { value: '100K+', label: 'Parcels sorted per day by systems I architected' },
  { value: '10K/hr', label: 'Sustained peak throughput' },
  { value: '2.5 mo', label: 'On-site in Madrid, taking a system live with the client team' },
  { value: '2', label: 'Peer-reviewed papers — IEEE & Wiley' },
];

export const experiences = [
  {
    code: 'CHK-03',
    status: 'Active',
    role: 'Software Engineer',
    company: 'Falcon Autotech Pvt Ltd',
    period: 'Jul 2024 — Present',
    location: 'Noida, India',
    scope: 'Design → build → on-site go-live → support',
    bullets: [
      'Architected high-throughput core sortation services processing 100,000+ parcels a day, built to sustain peak loads of 10,000+ parcels per hour.',
      'Led a 2.5-month on-site deployment in Madrid, Spain — integrating sorting and warehouse automation software for a major European last-mile e-commerce logistics provider, working directly with their team on the floor.',
      "Delivered an end-to-end automation project for one of India's largest retail companies — PTL (Put-to-Light) systems, conveyors, a .NET web backend and client-facing RabbitMQ integration APIs — and ran integration testing and UAT sign-off on-site with the client.",
      'Developed PLC communication layers that connect software to physical sortation hardware on the warehouse floor.',
      'Trained client teams with walkthroughs and live demos, and turned their feedback into on-the-spot improvements during rollout.',
      'Implemented cron-based schedulers for automated reporting, data sync and system health monitoring, plus optimised stored procedures for high-volume SQL data flows.',
      'Owned post-go-live support — debugging live issues and shipping fixes after handover.',
      'Deployed and remotely tested high-throughput PTL and conveyor automation supporting B2B and B2C fulfilment for a leading Middle Eastern apparel brand in Riyadh.',
    ],
    tech: ['.NET', 'C#', 'RabbitMQ', 'Windows Services', 'SQL Server', 'MySQL', 'RESTful APIs', 'PLC', 'SIT / UAT'],
  },
  {
    code: 'CHK-02',
    status: 'Delivered',
    role: 'Salesforce Developer Intern',
    company: 'TheSmartBridge',
    period: 'May 2023 — Jul 2023',
    location: 'Remote',
    bullets: [
      'Completed 3+ cloud projects and 10+ comprehensive Salesforce modules.',
      'Built custom applications with Apex and Flows to automate business processes.',
      'Implemented Shield Platform Encryption to harden data security.',
    ],
    tech: ['Apex', 'Salesforce Flows', 'Shield Encryption', 'Cloud Automation'],
  },
  {
    code: 'CHK-01',
    status: 'Delivered',
    role: 'Frontend Developer Intern',
    company: 'Ulavi Technologies',
    period: 'Jan 2023 — May 2023',
    location: 'Remote',
    bullets: [
      'Built an attraction-ticketing website with React and Tailwind CSS.',
      'Cut page load times by 20% through performance optimisation.',
      'Adopted Agile practices for 25% faster project delivery.',
    ],
    tech: ['React.js', 'Tailwind CSS', 'Performance Optimization', 'Agile'],
  },
];

export const skillBins = [
  { bin: 'A', title: 'Backend Core', skills: ['.NET', 'C#', 'RabbitMQ', 'Windows Services', 'RESTful APIs', 'API Design', 'Unit Testing', 'OOPs'] },
  { bin: 'B', title: 'Data & Storage', skills: ['SQL Server', 'MySQL', 'Stored Procedures', 'Database Design', 'NoSQL'] },
  { bin: 'C', title: 'Shipping to Production', skills: ['On-site deployment', 'SIT & UAT', 'Live debugging', 'Walkthroughs & demos', 'Client training', 'Stakeholder coordination', 'Documentation', 'Post-go-live support'] },
  { bin: 'D', title: 'AI, Tools & Cloud', skills: ['Claude Code', 'Codex', 'Cursor', 'Antigravity', 'RAG', 'LLMs & AI Agents', 'Vector search', 'AWS', 'GCP', 'Git · GitHub · Bitbucket'] },
];

export const softSkills = [
  'System Design', 'Debugging & Root-Cause Analysis', 'Data Structures & Algorithms', 'Clear communication',
  'Cross-team collaboration', 'Decision-making', 'Agile practices', 'Continuous learning',
];

export const publications = [
  {
    stat: '97.15%',
    statLabel: 'model accuracy on held-out data — beating a BERT baseline',
    title: 'A Pilot Study of a Gamified CBT-Based Digital Approach for Body Image Distress and Appearance-Related Concerns',
    journal: 'Human Behavior and Emerging Technologies (Wiley)',
    date: 'Jul 2026',
    abstract:
      'Body image concerns are a significant mental-health challenge, yet stigma, cost and limited access to professionals keep many from seeking help. We built a pilot-scale serious game that combines Cognitive Behavioural Therapy techniques with AI-driven, real-time emotional assessment to deliver interactive, personalised guidance. The adaptive feedback system offers more personalised support during play than traditional approaches. The AI model reached 97.15% accuracy on held-out test data, outperforming a BERT-based baseline classifier, and the study gives preliminary indications that gamification can be a scalable, accessible route to mental-health support.',
    tags: ['AI/ML', 'NLP', 'CBT', 'Serious games', 'Mental-health tech'],
  },
  {
    stat: '~99%',
    statLabel: 'ASL recognition accuracy on a self-built 40,000-image dataset',
    title: 'Impact of Colour Image and Skeleton Plotting on Sign Language Recognition Using Convolutional Neural Networks (CNN)',
    journal: 'IEEE',
    date: 'Mar 2024',
    abstract:
      'Sign language is a powerful, inclusive means of expression for the deaf and hard-of-hearing community. We introduced a CNN model for American Sign Language recognition, where users capture hand-gesture images and the model predicts the sign. The paper measures how preprocessing — colour images versus skeleton-mapped plotting — changes accuracy. With a self-created dataset of 40,000+ images and colour skeleton-mapped signs, we reached ~99% accuracy, showing how much preprocessing matters to CNN performance.',
    tags: ['CNN', 'Computer vision', 'Python', 'TensorFlow', 'Image processing'],
  },
];

export const highlights = [
  { label: '2.5 years in production', detail: 'Backend .NET/C# systems' },
  { label: 'Go-lives on two continents', detail: 'India · Madrid on-site · Riyadh' },
  { label: 'From code to sign-off', detail: 'SIT, UAT, training, support' },
  { label: '2 research publications', detail: 'IEEE + Wiley (HBET)' },
];

export const education = [
  { period: '2020 — 2024', school: 'Amity University, Noida', detail: 'B.Tech (Hons), Computer Science & Engineering · Minor in AI & Machine Learning' },
  { period: 'Study abroad', school: 'International academic exposure', detail: 'Adelphi University (New York, USA) & Birkbeck, University of London (UK)' },
  { period: 'Certifications', school: 'AWS Academy Graduate', detail: 'Elements of AI — University of Helsinki' },
];

export const offShift = [
  { title: 'Caffeine powered', desc: 'Deep down the specialty-coffee rabbit hole. Output is now measured in espresso shots and pour-over bloom times.' },
  { title: 'Web weaver', desc: "Massive comic-book nerd. I build the web all day and I'm still let down it won't let me swing between skyscrapers." },
  { title: 'Globe trotter', desc: 'Have passport, will travel — getting lost in foreign cities and pretending I speak the language.' },
  { title: 'Cinema purist', desc: "If I'm watching a movie, it's in a theatre. No laptops, no small screens, no exceptions." },
];

export const conveyorItems = [
  '.NET', 'C#', 'RabbitMQ', 'SQL Server', 'PLC', 'RESTful APIs', 'SIT & UAT', 'Windows Services',
  'System Design', 'RAG', 'AI Agents', 'AWS', 'On-site deployment', 'Claude Code', 'Live debugging', 'PTL',
];
