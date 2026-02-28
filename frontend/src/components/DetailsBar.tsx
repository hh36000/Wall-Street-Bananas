import { useEffect, useState, useRef } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import DeleteModal from '@/components/DeleteModal'

export const FunctionTypeValues = {
  FUNCTION: 'Function',
  ACTION: 'Action',
  UTILITY: 'Utility',
  AI: 'AI'
} as const

export type FunctionType = typeof FunctionTypeValues[keyof typeof FunctionTypeValues]

export interface IconOption {
  icon: LucideIcon
  name: string
  color: string
}

interface DetailsBarProps {
  isOpen: boolean
  onClose: () => void
  functionData?: {
    id: string
    name: string
    type: string
    comments: string
    icon: LucideIcon
    color?: string
    developer_prompt?: string
    user_prompt?: string
  }
  availableIcons?: IconOption[]
  onSave?: (updates: { name: string; type: string; comments: string; icon?: string; color?: string; developer_prompt?: string; user_prompt?: string }) => Promise<void>
  onDelete?: () => Promise<void>
  isLoading?: boolean
  isDeleting?: boolean
}

function DetailsBar({ isOpen, onClose, functionData, availableIcons = [], onSave, onDelete, isLoading = false, isDeleting = false }: DetailsBarProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<FunctionType>(FunctionTypeValues.AI)
  const [comments, setComments] = useState('')
  const [developerPrompt, setDeveloperPrompt] = useState('')
  const [userPrompt, setUserPrompt] = useState('')
  const [selectedIcon, setSelectedIcon] = useState<IconOption | null>(null)
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [hasChanges, setHasChanges] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const userPromptRef = useRef<HTMLDivElement>(null)

  // Update local state when functionData changes
  useEffect(() => {
    if (functionData) {
      setName(functionData.name)
      setType(functionData.type as FunctionType || FunctionTypeValues.AI)
      setComments(functionData.comments)
      setDeveloperPrompt(functionData.developer_prompt || '')
      setUserPrompt(functionData.user_prompt || '')
      setSelectedColor(functionData.color || '')
      // Find the matching icon option by comparing icon component references
      // We need to match by finding the icon that matches the functionData.icon
      const matchingIcon = availableIcons.find(opt => {
        // Compare the icon component directly
        return opt.icon === functionData.icon
      })
      if (matchingIcon) {
        setSelectedIcon(matchingIcon)
      } else {
        // Fallback: try to find by name if we have icon name stored
        setSelectedIcon(null)
      }
      setHasChanges(false)
    }
  }, [functionData, availableIcons])

  // Update contentEditable div when userPrompt changes externally (from functionData load)
  useEffect(() => {
    if (userPromptRef.current && functionData && userPrompt !== undefined) {
      const currentText = userPromptRef.current.textContent || ''
      
      // Only update if the text content is different (external change, not from typing)
      if (currentText !== userPrompt) {
        const html = userPrompt.split(/(\{\{\w+\}\})/g).map(part => {
          if (part.match(/^\{\{\w+\}\}$/)) {
            return `<span style="color: #6366f1; font-weight: 600;">${part}</span>`
          }
          return part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }).join('')
        
        userPromptRef.current.innerHTML = html
      }
    }
  }, [functionData, userPrompt])

  // Check if there are unsaved changes
  useEffect(() => {
    if (functionData) {
      // Check if icon or color changed
      const currentIconName = selectedIcon?.name
      const currentColor = selectedColor || ''
      const originalIconName = availableIcons.find(opt => opt.icon === functionData.icon)?.name
      const originalColor = functionData.color || ''
      
      const iconChanged = currentIconName !== originalIconName || currentColor !== originalColor
      const promptChanged = developerPrompt !== (functionData.developer_prompt || '') || userPrompt !== (functionData.user_prompt || '')
      const changed = 
        name !== functionData.name ||
        type !== functionData.type ||
        comments !== functionData.comments ||
        iconChanged ||
        promptChanged
      setHasChanges(changed)
    }
  }, [name, type, comments, developerPrompt, userPrompt, selectedIcon, selectedColor, functionData, availableIcons])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false)
        } else if (showIconPicker) {
          setShowIconPicker(false)
        } else if (isOpen) {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, showIconPicker, showDeleteConfirm, onClose])

  // Prevent body scroll when details bar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleNameChange = (value: string) => {
    setName(value)
  }

  const handleTypeChange = (value: FunctionType) => {
    setType(value)
  }

  const handleCommentsChange = (value: string) => {
    setComments(value)
  }

  const handleLoadExample = () => {
    setDeveloperPrompt("You are a helpful assistant that can answer questions. You are required to search the web for information each time the user asks a question. Never ask or offer a follow up question. Only answer the question.")
    setUserPrompt("return basic details about {{input}}")
  }

  const handleSave = async () => {
    if (onSave && hasChanges) {
      try {
        const updates: { name: string; type: string; comments: string; icon?: string; color?: string; developer_prompt?: string; user_prompt?: string } = {
          name,
          type,
          comments
        }
        if (selectedIcon) {
          updates.icon = selectedIcon.name
        }
        if (selectedColor) {
          updates.color = selectedColor
        }
        // Include prompt fields if type is AI
        if (type === FunctionTypeValues.AI) {
          updates.developer_prompt = developerPrompt
          updates.user_prompt = userPrompt
        }
        await onSave(updates)
        setHasChanges(false)
      } catch (error) {
        console.error('Error saving function:', error)
      }
    }
  }

  const handleIconSelect = (iconOption: IconOption) => {
    setSelectedIcon(iconOption)
    // Don't auto-set color, let user choose separately
    if (!selectedColor) {
      setSelectedColor(iconOption.color)
    }
  }

  const handleColorSelect = (color: string) => {
    setSelectedColor(color)
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (onDelete) {
      try {
        await onDelete()
        setShowDeleteConfirm(false)
      } catch (error) {
        console.error('Error deleting function:', error)
      }
    }
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
  }

  // Helper to save cursor position (text-based position)
  const saveCursorPosition = (): number => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || !userPromptRef.current) return 0
    
    const range = selection.getRangeAt(0)
    const preCaretRange = range.cloneRange()
    preCaretRange.selectNodeContents(userPromptRef.current)
    preCaretRange.setEnd(range.endContainer, range.endOffset)
    
    return preCaretRange.toString().length
  }

  // Helper to restore cursor position (text-based position)
  const restoreCursorPosition = (pos: number) => {
    if (!userPromptRef.current) return
    
    const selection = window.getSelection()
    if (!selection) return
    
    const range = document.createRange()
    let charCount = 0
    let foundPosition = false
    
    const traverseNodes = (node: Node): boolean => {
      if (node.nodeType === Node.TEXT_NODE) {
        const textLength = node.textContent?.length || 0
        if (charCount + textLength >= pos) {
          const offset = Math.min(pos - charCount, textLength)
          range.setStart(node, offset)
          range.setEnd(node, offset)
          return true
        }
        charCount += textLength
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          if (traverseNodes(node.childNodes[i])) {
            return true
          }
        }
      }
      return false
    }
    
    foundPosition = traverseNodes(userPromptRef.current)
    
    if (foundPosition) {
      selection.removeAllRanges()
      selection.addRange(range)
    } else {
      // Fallback: place cursor at the end
      range.selectNodeContents(userPromptRef.current)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  // Handle user prompt input with syntax highlighting
  const handleUserPromptInput = () => {
    if (!userPromptRef.current) return
    
    const text = userPromptRef.current.textContent || ''
    const cursorPos = saveCursorPosition()
    
    // Update state
    setUserPrompt(text)
    
    // Generate new HTML with highlighted variables
    const newHtml = text.split(/(\{\{\w+\}\})/g).map(part => {
      if (part.match(/^\{\{\w+\}\}$/)) {
        return `<span style="color: rgb(168, 85, 247); font-weight: 600;">${part}</span>`
      }
      // Escape HTML to prevent injection, but preserve text
      return part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }).join('')
    
    // Only update if HTML actually changed (to prevent unnecessary cursor jumps)
    const currentHtml = userPromptRef.current.innerHTML
    if (currentHtml !== newHtml) {
      // Update HTML
      userPromptRef.current.innerHTML = newHtml
      
      // Restore cursor position immediately (synchronously) after DOM update
      restoreCursorPosition(cursorPos)
    }
  }

  // Get unique icons (by name)
  const uniqueIcons = availableIcons.reduce((acc, iconOption) => {
    if (!acc.find(item => item.name === iconOption.name)) {
      acc.push(iconOption)
    }
    return acc
  }, [] as IconOption[])

  // Get unique colors
  const uniqueColors = Array.from(new Set(availableIcons.map(opt => opt.color)))

  if (!functionData) return null

  const IconComponent = selectedIcon?.icon || functionData.icon
  const displayColor = selectedColor || functionData.color || 'currentColor'

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:z-50 transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Details Bar */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[500px] lg:w-[600px] bg-card border-l border-border z-50 transform transition-transform duration-300 ease-out overflow-y-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowIconPicker(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-border hover:border-primary transition-colors cursor-pointer"
                  style={{ backgroundColor: `${displayColor}20`, borderColor: displayColor }}
                >
                  <IconComponent
                    className="w-5 h-5"
                    style={{ color: displayColor }}
                  />
                </button>
                <h2 className="text-2xl font-semibold text-foreground">
                  {name}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded-md"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Name Field */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Type Field */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Type
            </label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as FunctionType)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none cursor-pointer"
              >
                <option value={FunctionTypeValues.AI}>{FunctionTypeValues.AI}</option>
                <option value={FunctionTypeValues.FUNCTION}>{FunctionTypeValues.FUNCTION}</option>
                <option value={FunctionTypeValues.ACTION}>{FunctionTypeValues.ACTION}</option>
                <option value={FunctionTypeValues.UTILITY}>{FunctionTypeValues.UTILITY}</option>
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Comments Field */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Comments
            </label>
            <textarea
              value={comments}
              onChange={(e) => handleCommentsChange(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              rows={4}
              placeholder="Add comments..."
            />
          </div>

          {/* AI-specific fields */}
          {type === FunctionTypeValues.AI && (
            <>
              {/* Developer Prompt Field */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">
                    Developer Prompt
                  </label>
                  <button
                    onClick={handleLoadExample}
                    className="text-xs text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded hover:bg-primary/10"
                  >
                    Load Example
                  </button>
                </div>
                <textarea
                  value={developerPrompt}
                  onChange={(e) => setDeveloperPrompt(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={4}
                  placeholder="Enter the developer/system prompt..."
                />
              </div>

              {/* User Prompt Field */}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  User Prompt Template
                </label>
                <div
                  ref={userPromptRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleUserPromptInput}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[6rem] whitespace-pre-wrap break-words empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
                  data-placeholder="Enter the user prompt template (use {{variable}} for dynamic variables)..."
                />
                {userPrompt && (() => {
                  const variables = Array.from(new Set(Array.from(userPrompt.matchAll(/\{\{(\w+)\}\}/g)).map(match => match[1])))
                  return variables.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground">Detected variables:</span>
                      {variables.map((varName, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-semibold"
                          style={{ backgroundColor: '#6366f120', color: '#6366f1' }}
                        >
                          {`{{${varName}}}`}
                        </span>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-2 items-center pt-4 border-t border-border">
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting || isLoading}
              className="px-4 py-2 bg-destructive text-destructive-foreground font-semibold opacity-50 hover:opacity-100 rounded-md transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4 text-destructive-foreground" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isLoading || isDeleting}
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Icon Picker Modal */}
      {showIconPicker && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300"
            onClick={() => setShowIconPicker(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-card border border-border rounded-lg shadow-lg z-[70] p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Choose Icon & Color</h3>
              <button
                onClick={() => setShowIconPicker(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Icon Selection */}
            <div className="mb-6">
              <label className="text-sm font-medium text-foreground mb-3 block">Choose Icon</label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {uniqueIcons.map((iconOption) => {
                  const IconComp = iconOption.icon
                  const isSelected = selectedIcon?.name === iconOption.name
                  return (
                    <button
                      key={iconOption.name}
                      onClick={() => handleIconSelect(iconOption)}
                      className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <IconComp
                        className="w-6 h-6 mx-auto"
                        style={{ color: selectedColor || iconOption.color }}
                      />
                      <div className="text-xs text-center text-muted-foreground mt-1 truncate">
                        {iconOption.name}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <label className="text-sm font-medium text-foreground mb-3 block">Choose Color</label>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                {uniqueColors.map((color) => {
                  const isSelected = selectedColor === color
                  return (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-card'
                          : 'border-border hover:border-primary/50'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  )
                })}
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex justify-end mt-6 pt-4 border-t border-border">
              <button
                onClick={() => setShowIconPicker(false)}
                className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteModal
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        itemName={name}
        isDeleting={isDeleting}
        title="Delete Function"
      />
    </>
  )
}

export default DetailsBar

