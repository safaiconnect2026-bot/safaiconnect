export interface Exercise {
  type: 'multiple-choice' | 'drag-drop' | 'fill-blank' | 'matching' | 'true-false' | 'scenario' | 'video-lecture';
  question: string;
  image?: string;
  options?: string[];
  correctAnswer?: number | boolean;
  points: number;
  explanation?: string;
  context?: string;
  sentence?: string;
  correctAnswers?: string[][];
  hints?: string[];
  items?: string[];
  categories?: string[];
  correctMapping?: Record<string, string>;
  leftItems?: string[];
  rightItems?: string[];
  correctMatches?: number[];
  statement?: string;
  scenario?: string;
  icon?: string;
  videoUrl?: string;
  videoTitle?: string;
}

export interface TrainingModule {
  id: number;
  title: string;
  description: string;
  icon: string;
  duration: string;
  points: number;
  objectives: string[];
  exercises: Exercise[];
  level: number;
  prerequisites?: number[];
}

export const TRAINING_MODULES: Record<string, TrainingModule[]> = {
  citizen: [
    {
      id: 1,
      title: 'Waste Segregation Mastery',
      description: 'Learn the fundamentals of proper waste segregation',
      icon: '🗂️',
      duration: '20 min',
      points: 100,
      level: 1,
      objectives: [
        'Identify different types of waste materials',
        'Learn proper segregation techniques',
        'Understand color-coded bin systems',
        'Practice sorting common household items'
      ],
      exercises: [
        {
          type: 'video-lecture',
          question: 'Watch this guide on proper waste segregation',
          videoTitle: 'Waste Segregation Guide',
          videoUrl: 'CZBT2aUGlNs',
          points: 50,
          explanation: 'Visual learning helps reinforce proper sorting habits.'
        },
        {
          type: 'multiple-choice',
          question: 'Which bin should you use for food scraps and organic waste?',
          image: '🥬',
          options: ['Red Bin', 'Green Bin', 'Blue Bin', 'Yellow Bin'],
          correctAnswer: 1,
          points: 10,
          explanation: 'Green bins are designated for organic waste like food scraps, garden waste, and biodegradable materials.'
        },
        {
          type: 'drag-drop',
          question: 'Sort these items into the correct waste categories:',
          items: ['Banana Peel', 'Plastic Bottle', 'Newspaper', 'Glass Jar'],
          categories: ['Organic', 'Recyclable', 'Paper', 'Glass'],
          correctMapping: { 'Banana Peel': 'Organic', 'Plastic Bottle': 'Recyclable', 'Newspaper': 'Paper', 'Glass Jar': 'Glass' },
          points: 15
        },
        {
          type: 'true-false',
          statement: 'Pizza boxes with grease stains can be recycled with regular paper.',
          correctAnswer: false,
          context: 'Grease and food residue contaminate the recycling process.',
          points: 10,
          explanation: 'Greasy pizza boxes should go in organic waste or general waste, not recycling.',
          question: ""
        }
      ]
    },
    {
      id: 2,
      title: 'Recycling Champion',
      description: 'Master the art of recycling and circular economy',
      icon: '♻️',
      duration: '25 min',
      points: 120,
      level: 1,
      objectives: [
        'Understand recycling symbols and codes',
        'Learn what can and cannot be recycled',
        'Discover creative reuse ideas',
        'Calculate your recycling impact'
      ],
      exercises: [
        {
          type: 'matching',
          question: 'Match the recycling symbols with their meanings:',
          leftItems: ['♻️ 1', '♻️ 2', '♻️ 3', '♻️ 5'],
          rightItems: ['HDPE', 'PET', 'PVC', 'PP'],
          correctMatches: [1, 0, 2, 3],
          points: 15
        },
        {
          type: 'fill-blank',
          sentence: 'The three R\'s of waste management are ___, ___, and ___.',
          correctAnswers: [['reduce'], ['reuse'], ['recycle']],
          hints: ['Reduce', 'Reuse', 'Recycle'],
          points: 15,
          question: ""
        }
      ]
    },
    {
      id: 3,
      title: 'Community Environmental Leader',
      description: 'Become a leader in your community\'s environmental efforts',
      icon: '🌱',
      duration: '30 min',
      points: 150,
      level: 2,
      prerequisites: [1, 2],
      objectives: [
        'Learn community engagement strategies',
        'Understand environmental impact measurement',
        'Develop leadership skills',
        'Create action plans for change'
      ],
      exercises: [
        {
          type: 'scenario',
          icon: '👥',
          scenario: 'Your neighborhood has a problem with littering in the local park. Children play there daily, but families are starting to avoid it due to the mess.',
          question: 'As a community leader, what would be your first step?',
          options: [
            'Organize a cleanup day and invite neighbors',
            'Complain to the municipal authorities',
            'Put up angry signs about littering',
            'Avoid the park like everyone else'
          ],
          correctAnswer: 0,
          points: 25,
          explanation: 'Community engagement and positive action are the most effective ways to create lasting change.'
        }
      ]
    }
  ],
  worker: [
    {
      id: 1,
      title: 'Safety First Protocol',
      description: 'Essential safety procedures for waste management workers',
      icon: '🦺',
      duration: '35 min',
      points: 150,
      level: 1,
      objectives: [
        'Master personal protective equipment usage',
        'Learn hazard identification and response',
        'Understand emergency procedures',
        'Practice safe lifting and handling techniques'
      ],
      exercises: [
        {
          type: 'video-lecture',
          question: 'Essential Safety Protocols for Waste Collectors',
          videoTitle: 'Waste Management Safety',
          videoUrl: 'dGpVNEMaL88',
          points: 50,
          explanation: 'Safety is the top priority in waste management operations.'
        },
        {
          type: 'multiple-choice',
          question: 'What is the most important PPE item for waste collection workers?',
          image: '🦺',
          options: ['Safety gloves', 'Hard hat', 'Safety vest', 'All of the above'],
          correctAnswer: 3,
          points: 10,
          explanation: 'All PPE items work together to provide comprehensive protection.'
        },
        {
          type: 'scenario',
          icon: '⚠️',
          scenario: 'While collecting waste, you notice a bag that smells strongly of chemicals and has a suspicious liquid leaking from it.',
          question: 'What should you do immediately?',
          options: [
            'Pick it up quickly and dispose of it',
            'Stop, secure the area, and report to supervisor',
            'Pour water on it to dilute the chemicals',
            'Ask a colleague to handle it instead'
          ],
          correctAnswer: 1,
          points: 25,
          explanation: 'Chemical hazards require immediate reporting and professional handling.'
        }
      ]
    },
    {
      id: 2,
      title: 'Equipment Mastery',
      description: 'Learn to operate and maintain waste management equipment',
      icon: '🚛',
      duration: '40 min',
      points: 180,
      level: 1,
      objectives: [
        'Understand different types of waste collection vehicles',
        'Learn proper equipment maintenance',
        'Master loading and unloading procedures',
        'Troubleshoot common equipment issues'
      ],
      exercises: [
        {
          type: 'matching',
          question: 'Match the equipment with its primary use:',
          leftItems: ['Compactor Truck', 'Side Loader', 'Front Loader', 'Roll-off Truck'],
          rightItems: ['Commercial Dumpsters', 'Residential Bins', 'Large Containers', 'General Collection'],
          correctMatches: [3, 1, 0, 2],
          points: 20
        }
      ]
    },
    {
      id: 3,
      title: 'Route Optimization Expert',
      description: 'Optimize collection routes for maximum efficiency',
      icon: '🗺️',
      duration: '30 min',
      points: 140,
      level: 2,
      prerequisites: [1, 2],
      objectives: [
        'Learn route planning principles',
        'Understand traffic pattern optimization',
        'Master fuel efficiency techniques',
        'Develop time management skills'
      ],
      exercises: [
        {
          type: 'scenario',
          icon: '🚛',
          scenario: 'You have 50 stops to make today, but there\'s unexpected road construction on your usual route that will add 2 hours to your schedule.',
          question: 'What\'s the best approach?',
          options: [
            'Stick to the original route despite delays',
            'Skip some stops to stay on schedule',
            'Reroute using alternative roads and adjust stop sequence',
            'Call in sick and let someone else handle it'
          ],
          correctAnswer: 2,
          points: 25,
          explanation: 'Flexibility and smart rerouting ensure all stops are completed efficiently.'
        }
      ]
    }
  ],
  'green-champion': [
    {
      id: 1,
      title: 'Community Leadership Mastery',
      description: 'Lead environmental initiatives in your community',
      icon: '👑',
      duration: '45 min',
      points: 200,
      level: 1,
      objectives: [
        'Develop leadership and communication skills',
        'Learn to organize community events',
        'Master environmental education techniques',
        'Create sustainable behavior change programs'
      ],
      exercises: [
        {
          type: 'video-lecture',
          question: 'Inspiring Community Action',
          videoTitle: 'Community Leaders on Impactful Organizing',
          videoUrl: 'e0P70wz3F84',
          points: 50,
          explanation: 'Leadership starts with understanding community needs and empowering others.'
        },
        {
          type: 'scenario',
          icon: '🎪',
          scenario: 'You want to organize a community cleanup event, but only 3 people signed up out of 200 households in your area.',
          question: 'What strategy would be most effective to increase participation?',
          options: [
            'Cancel the event due to low interest',
            'Go door-to-door to personally invite neighbors',
            'Partner with local schools, offer incentives, and use social media to build excitement',
            'Complain about community apathy'
          ],
          correctAnswer: 2,
          points: 30,
          explanation: 'Multi-channel engagement and creating value for participants drives higher participation.'
        }
      ]
    },
    {
      id: 2,
      title: 'Environmental Impact Assessment',
      description: 'Measure and communicate environmental impact',
      icon: '📊',
      duration: '35 min',
      points: 170,
      level: 1,
      objectives: [
        'Learn to measure environmental metrics',
        'Understand carbon footprint calculations',
        'Create compelling impact reports',
        'Use data to drive community action'
      ],
      exercises: [
        {
          type: 'fill-blank',
          sentence: 'One ton of recycled paper saves approximately ___ trees and ___ gallons of water.',
          correctAnswers: [['17'], ['7000', '7,000']],
          hints: ['17', '7000'],
          points: 20,
          question: ""
        }
      ]
    }
  ],
  admin: [
    {
      id: 1,
      title: 'System Management Excellence',
      description: 'Master waste management system administration',
      icon: '⚙️',
      duration: '60 min',
      points: 250,
      level: 1,
      objectives: [
        'Understand system architecture and workflows',
        'Learn performance monitoring and optimization',
        'Master resource allocation and planning',
        'Develop crisis management skills'
      ],
      exercises: [
        {
          type: 'video-lecture',
          question: 'Strategic Waste Systems Management',
          videoTitle: 'Modern Waste Management Systems',
          videoUrl: 'LH6e45-HJhU',
          points: 50,
          explanation: 'Effective management requires understanding the entire waste lifecycle.'
        },
        {
          type: 'scenario',
          icon: '📈',
          scenario: 'Your city\'s waste collection efficiency has dropped to 75% this month. Citizens are complaining about missed pickups, and costs are 20% over budget.',
          question: 'What should be your immediate priority?',
          options: [
            'Blame the workers for poor performance',
            'Analyze data to identify bottlenecks, reallocate resources, and communicate with citizens',
            'Ignore the problem and hope it resolves itself',
            'Reduce service frequency to cut costs'
          ],
          correctAnswer: 1,
          points: 30,
          explanation: 'Data-driven analysis and proactive communication are essential for effective system management.'
        }
      ]
    }
  ],
  superadmin: [
    {
      id: 1,
      title: 'Strategic System Leadership',
      description: 'Master strategic oversight of waste management systems',
      icon: '🏛️',
      duration: '90 min',
      points: 300,
      level: 1,
      objectives: [
        'Develop strategic planning skills',
        'Master system-wide analytics and reporting',
        'Learn policy development and implementation',
        'Understand municipal governance and compliance'
      ],
      exercises: [
        {
          type: 'video-lecture',
          question: 'Leadership in Sustainable Urban Development',
          videoTitle: 'Urban Sustainability Leadership',
          videoUrl: 'v_3Y8h5G0sM',
          points: 60,
          explanation: 'Visionary leadership drives long-term sustainable change.'
        },
        {
          type: 'scenario',
          icon: '🏙️',
          scenario: 'The city council wants to implement a new waste-to-energy program, but citizens are concerned about environmental impact and costs.',
          question: 'How do you approach this challenge?',
          options: [
            'Force implementation without public consultation',
            'Abandon the program due to opposition',
            'Develop a comprehensive stakeholder engagement plan with transparent communication and pilot programs',
            'Delegate the decision to lower-level administrators'
          ],
          correctAnswer: 2,
          points: 40,
          explanation: 'Strategic leadership requires balancing multiple stakeholder interests through transparent, evidence-based decision making.'
        }
      ]
    }
  ]
};