import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  icon?: string; // Emoji or icon
  group?: string; // For grouping options
  disabled?: boolean;
  description?: string; // Optional description for the option
}

export interface SelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  helperText?: string;
  error?: string;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  searchable?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  label,
  helperText,
  error,
  showCount = false,
  size = 'md',
  searchable = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Group options if they have group property
  const groupedOptions: Record<string, SelectOption[]> = {};
  const ungroupedOptions: SelectOption[] = [];

  options.forEach((option) => {
    if (option.group) {
      if (!groupedOptions[option.group]) {
        groupedOptions[option.group] = [];
      }
      groupedOptions[option.group].push(option);
    } else {
      ungroupedOptions.push(option);
    }
  });

  const hasGroups = Object.keys(groupedOptions).length > 0;

  // Filter options based on search
  const filteredOptions = searchTerm
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
          option.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const selectedOption = options.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, searchable]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSearchTerm('');
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, highlightedIndex, filteredOptions]);

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(0);
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-sm',
    lg: 'px-5 py-4 text-base',
  };

  const buttonClasses = `
    w-full flex items-center justify-between border rounded-lg shadow-sm
    transition-all bg-white cursor-pointer
    ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'hover:border-gray-400 hover:shadow-md'}
    ${error ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'}
    ${isOpen ? 'border-blue-500 ring-2 ring-blue-200' : ''}
    ${sizeClasses[size]}
    ${className}
  `;

  const renderGroupedOptions = () => {
    const groups: JSX.Element[] = [];

    // Render ungrouped options
    if (ungroupedOptions.length > 0) {
      const filtered = ungroupedOptions.filter((opt) =>
        filteredOptions.includes(opt)
      );
      if (filtered.length > 0) {
        groups.push(
          <div key="ungrouped">
            {filtered.map((option, index) => renderOption(option, index))}
          </div>
        );
      }
    }

    // Render grouped options
    if (hasGroups) {
      Object.entries(groupedOptions).forEach(([groupName, groupOptions]) => {
        const filtered = groupOptions.filter((opt) =>
          filteredOptions.includes(opt)
        );
        if (filtered.length > 0) {
          groups.push(
            <div key={groupName} className="mt-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                {groupName}
              </div>
              {filtered.map((option) => {
                const globalIndex = filteredOptions.indexOf(option);
                return renderOption(option, globalIndex);
              })}
            </div>
          );
        }
      });
    }

    return groups;
  };

  const renderOption = (option: SelectOption, index: number) => {
    const isHighlighted = index === highlightedIndex;
    const isSelected = option.value === value;

    return (
      <div
        key={option.value}
        onClick={() => handleSelect(option)}
        className={`
          px-4 py-3 cursor-pointer transition-colors flex items-center justify-between
          ${isHighlighted ? 'bg-blue-50' : ''}
          ${isSelected ? 'bg-blue-100 font-medium' : ''}
          ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}
          ${!isHighlighted && !isSelected ? 'hover:bg-gray-50' : ''}
        `}
        onMouseEnter={() => setHighlightedIndex(index)}
      >
        <div className="flex items-center flex-1 min-w-0">
          {option.icon && (
            <span className="mr-3 text-lg flex-shrink-0">{option.icon}</span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">{option.label}</div>
            {option.description && (
              <div className="text-xs text-gray-500 truncate mt-0.5">
                {option.description}
              </div>
            )}
          </div>
        </div>
        {isSelected && (
          <svg
            className="w-5 h-5 text-blue-600 flex-shrink-0 ml-2"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </div>
    );
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          {label}
          {showCount && options.length > 0 && (
            <span className="ml-2 text-xs text-gray-500 font-normal">
              ({options.length} {options.length === 1 ? 'option' : 'options'})
            </span>
          )}
        </label>
      )}

      <div className="relative">
        {/* Trigger Button */}
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={buttonClasses}
        >
          <div className="flex items-center flex-1 min-w-0">
            {selectedOption?.icon && (
              <span className="mr-3 text-lg flex-shrink-0">
                {selectedOption.icon}
              </span>
            )}
            <span
              className={`truncate ${
                selectedOption ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ml-2 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden">
            {/* Search Input */}
            {searchable && (
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <svg
                    className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="overflow-y-auto max-h-64 py-1">
              {filteredOptions.length > 0 ? (
                renderGroupedOptions()
              ) : (
                <div className="px-4 py-8 text-center text-gray-500 text-sm">
                  No options found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Helper text or error message */}
      {(helperText || error) && (
        <p
          className={`mt-2 text-sm ${
            error ? 'text-red-600' : 'text-gray-500'
          }`}
        >
          {error || helperText}
        </p>
      )}
    </div>
  );
};

// Hook for easy model list formatting
export const useModelOptions = (
  models: string[],
  addIcons: boolean = true
): SelectOption[] => {
  return models.map((model) => {
    let icon = '';
    let group = '';

    if (addIcons) {
      // Add icons for popular models
      if (model.includes('claude-3.7') || model.includes('o3')) {
        icon = '⭐';
      } else if (
        model.includes('gpt-4o') ||
        model.includes('claude-3.5') ||
        model.includes('gemini-2.5')
      ) {
        icon = '✨';
      } else if (
        model.includes('gpt-4') ||
        model.includes('claude-3') ||
        model.includes('gemini-2')
      ) {
        icon = '🔥';
      }
    }

    // Auto-group by provider
    if (model.startsWith('openai/') || model.includes('gpt')) {
      group = 'OpenAI';
    } else if (model.startsWith('anthropic/') || model.includes('claude')) {
      group = 'Anthropic';
    } else if (model.startsWith('google/') || model.includes('gemini') || model.includes('gemma')) {
      group = 'Google';
    } else if (model.startsWith('meta-llama/') || model.includes('llama')) {
      group = 'Meta';
    } else if (model.startsWith('mistralai/') || model.includes('mistral') || model.includes('mixtral')) {
      group = 'Mistral';
    } else if (model.startsWith('deepseek/')) {
      group = 'DeepSeek';
    } else if (model.startsWith('qwen/')) {
      group = 'Qwen';
    } else if (model.startsWith('x-ai/')) {
      group = 'xAI';
    }

    return {
      value: model,
      label: model,
      icon,
      group,
    };
  });
};
