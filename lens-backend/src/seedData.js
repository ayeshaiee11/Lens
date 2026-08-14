// Ported 1:1 from LensDashboard.jsx so a freshly created account
// starts with the same demo content the frontend used to seed
// into localStorage.

const SEED_INVESTIGATIONS_RAW = [
  {
    key: 'llm', title: 'How LLMs Actually Learn', baseSourceCount: 10, updated: '2h ago', percent: 72,
    icon: 'BrainCircuit', tint: '#A78BFA', bg: 'rgba(167,139,250,0.14)', status: 'In Progress', visibility: 'Private',
    coords: [[14, 60], [34, 30], [52, 52], [70, 22], [86, 44], [60, 74]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]],
    concepts: ['Attention Mechanism', 'Tokenization', 'Scaling Laws', 'Transformer Architecture', 'Emergent Abilities', 'Fine-tuning'],
    conceptDescs: [
      'A mechanism letting a model weigh which tokens matter most when predicting the next one.',
      'The process of splitting text into sub-word units a model can process as numbers.',
      'Empirical patterns describing how model performance improves with size, data, and compute.',
      'The neural network design built on self-attention that underlies modern LLMs.',
      'Capabilities that appear only after a model crosses a certain scale threshold.',
      'Adapting a pretrained model to a narrower task using additional targeted training.',
    ],
    claims: [
      'Larger models show emergent abilities beyond a scale threshold.',
      'Attention heads specialize in distinct linguistic roles across layers.',
      'Instruction tuning meaningfully improves zero-shot task performance.',
    ],
    questions: [
      'How do different attention heads specialize?',
      'What are the limitations of current LLM architectures?',
      'Is scale alone sufficient for reasoning ability?',
    ],
  },
  {
    key: 'climate', title: 'Climate Change & Oceans', baseSourceCount: 8, updated: '1d ago', percent: 64,
    icon: 'Leaf', tint: '#2DD4BF', bg: 'rgba(45,212,191,0.14)', status: 'In Progress', visibility: 'Private',
    coords: [[18, 34], [40, 58], [58, 30], [76, 54], [50, 78], [88, 24]],
    edges: [[0, 1], [1, 2], [2, 3], [1, 4], [3, 5]],
    concepts: ['Ocean Acidification', 'Coral Bleaching', 'Sea Level Rise', 'Thermal Expansion', 'Carbon Sequestration', 'Feedback Loops'],
    conceptDescs: [
      'A drop in ocean pH driven by increased absorption of atmospheric carbon dioxide.',
      'Loss of coral color and vitality caused by stress from warming waters.',
      'The gradual rise of the oceans from melting ice and warming water.',
      'Ocean water expanding in volume as it warms, contributing to sea level rise.',
      'Natural or engineered processes that capture and store atmospheric carbon.',
      'Self-reinforcing cycles that can accelerate or dampen climate change.',
    ],
    claims: [
      'Renewable energy will become the dominant global source by 2040.',
      'Coral reefs could see irreversible decline within decades without intervention.',
    ],
    questions: [
      'What are the limitations of current LLM architectures?',
      'How quickly can ocean ecosystems adapt to warming trends?',
    ],
  },
  {
    key: 'energy', title: 'The Future of Energy', baseSourceCount: 10, updated: '3d ago', percent: 48,
    icon: 'Zap', tint: '#F59E0B', bg: 'rgba(245,158,11,0.14)', status: 'In Progress', visibility: 'Public',
    coords: [[16, 46], [38, 20], [46, 66], [66, 40], [82, 62], [84, 18]],
    edges: [[0, 1], [0, 2], [1, 3], [3, 4], [3, 5]],
    concepts: ['Solar Efficiency', 'Grid Storage', 'Nuclear Fusion', 'Carbon Pricing', 'Renewable Mix', 'Energy Density'],
    conceptDescs: [
      'How much of the sun\u2019s energy a photovoltaic cell converts into usable power.',
      'Technology for storing surplus renewable power for use when demand is high.',
      'A reaction fusing light nuclei together, releasing large amounts of clean energy.',
      'Assigning a cost to carbon emissions to incentivize cleaner alternatives.',
      'The blend of energy sources, renewable and otherwise, powering a grid.',
      'The amount of energy stored per unit of mass or volume of a fuel source.',
    ],
    claims: [
      'Grid-scale storage is the key bottleneck to renewable adoption.',
      'Fusion power remains at least a decade from commercial viability.',
    ],
    questions: [
      'Which storage technology will scale fastest this decade?',
      'How does carbon pricing affect industrial adoption speed?',
    ],
  },
  {
    key: 'quantum', title: 'Quantum Computing Basics', baseSourceCount: 6, updated: '5d ago', percent: 80,
    icon: 'Atom', tint: '#38BDF8', bg: 'rgba(56,189,248,0.14)', status: 'Completed', visibility: 'Private',
    coords: [[20, 40], [42, 22], [58, 52], [30, 72], [78, 34], [86, 66]],
    edges: [[0, 1], [0, 3], [1, 2], [2, 4], [4, 5]],
    concepts: ['Superposition', 'Entanglement', 'Qubits', 'Quantum Gates', 'Decoherence', 'Quantum Supremacy'],
    conceptDescs: [
      'A quantum state existing in multiple configurations at once until measured.',
      'A correlation between particles where measuring one instantly affects another.',
      'The basic unit of quantum information, analogous to a classical bit.',
      'Operations that manipulate qubits, forming the building blocks of quantum circuits.',
      'The loss of quantum behavior as a system interacts with its environment.',
      'The point where a quantum computer outperforms classical computers on a task.',
    ],
    claims: [
      'Error correction remains the main obstacle to useful quantum computers.',
      'Quantum advantage has been demonstrated for narrow, specific problems.',
    ],
    questions: [
      'How many logical qubits are needed for practical algorithms?',
      'What industries will benefit first from quantum speedups?',
    ],
  },
  {
    key: 'ethics', title: 'AI Ethics & Society', baseSourceCount: 7, updated: '7d ago', percent: 55,
    icon: 'Scale', tint: '#F472B6', bg: 'rgba(244,114,182,0.14)', status: 'In Progress', visibility: 'Shared',
    coords: [[16, 50], [38, 24], [54, 62], [72, 30], [86, 56], [46, 82]],
    edges: [[0, 1], [1, 3], [3, 4], [0, 2], [2, 5]],
    concepts: ['Bias in AI', 'Accountability', 'Transparency', 'Autonomy', 'Fairness Metrics', 'Regulation'],
    conceptDescs: [
      'Systematic skew in model outputs, often inherited from training data.',
      'Who bears responsibility for outcomes produced by an automated system.',
      'How explainable and inspectable a model\u2019s decisions are to outsiders.',
      'The degree to which a system operates without human oversight.',
      'Quantitative measures used to assess whether a system treats groups fairly.',
      'Legal and policy frameworks governing the design and use of AI systems.',
    ],
    claims: [
      'Self-regulation by AI labs is insufficient without external oversight.',
      'Fairness metrics often trade off against each other mathematically.',
    ],
    questions: [
      'What are the limitations of current LLM architectures?',
      'Who should be liable when an autonomous system causes harm?',
    ],
  },
  {
    key: 'brain', title: 'Human Brain: A Deep Dive', baseSourceCount: 9, updated: '9d ago', percent: 70,
    icon: 'BrainCircuit', tint: '#60A5FA', bg: 'rgba(96,165,250,0.14)', status: 'Completed', visibility: 'Private',
    coords: [[18, 30], [40, 56], [56, 24], [74, 50], [50, 78], [88, 20]],
    edges: [[0, 1], [1, 2], [1, 4], [2, 3], [3, 5]],
    concepts: ['Neuroplasticity', 'Synaptic Pruning', 'Cortex Regions', 'Neurotransmitters', 'Memory Formation', 'Consciousness'],
    conceptDescs: [
      'The brain\u2019s ability to reorganize itself by forming new neural connections.',
      'The process of eliminating weaker synapses to make neural circuits more efficient.',
      'Specialized areas of the cortex responsible for distinct cognitive functions.',
      'Chemical messengers that transmit signals between neurons.',
      'The biological process by which experiences become stored, retrievable memories.',
      'The subjective experience of awareness, still not fully explained by neuroscience.',
    ],
    claims: [
      'Sleep plays a causal role in long-term memory consolidation.',
      'Neuroplasticity continues meaningfully into adulthood.',
    ],
    questions: [
      'How localized are specific memories within the cortex?',
      'What distinguishes consciousness from complex information processing?',
    ],
  },
];

const SEED_SOURCES_RAW = [
  { title: 'Attention Is All You Need', domain: 'arxiv.org', type: 'Research Paper', added: '2h ago', icon: 'FileText', tint: '#818CF8', usedIn: ['llm'] },
  { title: 'The Illustrated Transformer', domain: 'jalammar.github.io', type: 'Article', added: '3h ago', icon: 'ExternalLink', tint: '#38BDF8', usedIn: ['llm'] },
  { title: '3Blue1Brown: Transformers', domain: 'youtube.com', type: 'YouTube', added: '5h ago', icon: 'Video', tint: '#F43F5E', usedIn: ['llm'] },
  { title: 'LLM Survey 2024', domain: 'lmsys.org', type: 'PDF', added: '1d ago', icon: 'FileText', tint: '#2DD4BF', usedIn: ['llm', 'ethics'] },
  { title: 'Understanding Tokenization', domain: 'towardsdatascience.com', type: 'Article', added: '2d ago', icon: 'ExternalLink', tint: '#38BDF8', usedIn: ['llm'] },
  { title: 'Emerging Architectures for LLMs', domain: 'arxiv.org', type: 'Research Paper', added: '3d ago', icon: 'FileText', tint: '#818CF8', usedIn: ['llm'] },
  { title: 'State of AI Report 2024', domain: 'stateof.ai', type: 'PDF', added: '5d ago', icon: 'FileText', tint: '#2DD4BF', usedIn: ['llm', 'ethics'] },
];

const NOTIF_SEED_TEMPLATES = [
  { text: 'Welcome to LENS \u2014 start by adding a source or asking a question.', type: 'info', read: false },
  { text: 'Your investigation "How LLMs Actually Learn" reached 72% coverage.', type: 'progress', read: false },
  { text: '3 new sources were suggested for "Climate Change & Oceans".', type: 'suggestion', read: true },
];

function circleLayout(n, cx = 50, cy = 48, r = 30) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * 0.78 * Math.sin(a))]);
  }
  return pts;
}

function ringEdges(n) {
  const e = [];
  for (let i = 0; i < n - 1; i++) e.push([i, i + 1]);
  if (n > 2) e.push([0, n - 1]);
  return e;
}

module.exports = {
  SEED_INVESTIGATIONS_RAW,
  SEED_SOURCES_RAW,
  NOTIF_SEED_TEMPLATES,
  circleLayout,
  ringEdges,
};
