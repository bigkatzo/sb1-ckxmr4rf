import { PRODUCT_TEMPLATES } from './templates/templateData';
import { CustomTemplateUploader } from './CustomTemplateUploader';

interface MockupTemplateSelectorProps {
  selectedTemplate: string;
  onSelectTemplate: (templateId: string) => void;
  customTemplatePath?: string;
  onCustomTemplateUpload: (templateUrl: string) => void;
  onCustomTemplateRemove: () => void;
}

export function MockupTemplateSelector({
  selectedTemplate,
  onSelectTemplate,
  customTemplatePath,
  onCustomTemplateUpload,
  onCustomTemplateRemove
}: MockupTemplateSelectorProps) {
  // Get templates excluding the custom one
  const standardTemplates = PRODUCT_TEMPLATES.filter(t => !t.isUserTemplate);
  
  return (
    <div>
      {/* Custom Template Uploader */}
      <CustomTemplateUploader 
        onTemplateUpload={onCustomTemplateUpload}
        onTemplateRemove={onCustomTemplateRemove}
        hasTemplate={!!customTemplatePath}
        templatePreview={customTemplatePath}
      />
      
      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-700"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-900 px-4 text-xs text-gray-400">OR CHOOSE A TEMPLATE</span>
        </div>
      </div>
      
      {/* Standard Templates */}
      <label className="block text-sm font-medium mb-2">Product Templates</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {standardTemplates.map((template) => (
          <div 
            key={template.id}
            className={`
              relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
              ${selectedTemplate === template.id 
                ? 'border-primary ring-2 ring-primary/30' 
                : 'border-gray-700 hover:border-gray-500'}
            `}
            onClick={() => onSelectTemplate(template.id)}
          >
            <div className="aspect-square">
              <img 
                src={template.path} 
                alt={template.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5">
              <p className="text-xs text-white text-center truncate">{template.name}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 