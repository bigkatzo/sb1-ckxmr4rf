import { Link } from 'react-router-dom';
import { Layers, Grid, PaintBucket } from 'lucide-react';

export function StudioPage() {
  // List of available studio tools
  const studioTools = [
    {
      id: 'mockup-generator',
      name: 'Mockup Generator',
      description: 'Create realistic product mockups by adding your designs to t-shirts, hoodies, and more.',
      icon: <Layers className="h-8 w-8" />,
      path: '/studio/mockup-generator'
    },
    // Additional tools can be added here as the studio expands
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <PaintBucket className="h-8 w-8 mr-3 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Design Studio</h1>
        </div>
        
        <p className="text-gray-400 mb-8">
          Access powerful design tools to help you create and visualize your products.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {studioTools.map((tool) => (
            <Link 
              key={tool.id}
              to={tool.path}
              className="block p-6 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700"
            >
              <div className="flex items-start">
                <div className="mr-4 text-primary">
                  {tool.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">{tool.name}</h3>
                  <p className="text-gray-400 text-sm">{tool.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
} 