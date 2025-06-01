import { MockupGenerator } from '../../components/studio/mockup/MockupGenerator';

export function MockupGeneratorPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Product Mockup Generator</h1>
        <p className="text-gray-400 mb-8">
          Upload your transparent PNG design and place it on various product templates to create mockups.
        </p>
        
        <MockupGenerator />
      </div>
    </div>
  );
} 