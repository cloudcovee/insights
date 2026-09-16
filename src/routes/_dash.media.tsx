import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Image as ImageIcon, FileText, File, Video, Search, Download, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { formatUserId } from "@/lib/utils";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Route = createFileRoute("/_dash/media")({
  component: MediaDashboard,
});

function MediaDashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadEvents = async () => {
      try {
        const response = await fetch('/api/events');
        if (!response.ok) return;
        const rawEvents = await response.json();
        if (!mounted || !Array.isArray(rawEvents)) return;
        
        const uploads = rawEvents.filter(e => e.event === 'file_upload');
        setEvents(uploads.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      } catch (err) {
        console.error('Error fetching media events', err);
      }
    };
    
    loadEvents();
    const interval = setInterval(loadEvents, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const projects = Array.from(new Set(events.map(e => e.projectId || 'Unknown')));

  const filteredEvents = events.filter(e => {
    const matchesProject = selectedProject === 'all' || (e.projectId || 'Unknown') === selectedProject;
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      (e.properties?.fileName || '').toLowerCase().includes(searchLower) ||
      (e.userId || '').toLowerCase().includes(searchLower) ||
      (e.anonId || '').toLowerCase().includes(searchLower);
    
    return matchesProject && matchesSearch;
  });

  const getIcon = (mimeType: string) => {
    if (!mimeType) return <File className="h-8 w-8 text-muted-foreground" />;
    if (mimeType.startsWith('image/')) return <ImageIcon className="h-8 w-8 text-blue-500" />;
    if (mimeType.startsWith('video/')) return <Video className="h-8 w-8 text-purple-500" />;
    if (mimeType.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();

      // Trigger analytics event
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: 'file_upload',
          timestamp: new Date().toISOString(),
          projectId: 'Dashboard',
          userId: 'Dashboard User',
          properties: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            fileUrl: url,
          }
        })
      });

      toast.success("File uploaded successfully");
      
      // Clear input
      e.target.value = '';
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Media & Uploads"
        subtitle="Track files uploaded by your users across all projects."
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by file name or user ID..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="shrink-0 relative">
          <input 
            type="file" 
            id="dashboard-upload" 
            className="hidden" 
            onChange={handleUpload}
            disabled={isUploading}
          />
          <Button asChild disabled={isUploading}>
            <label htmlFor="dashboard-upload" className="cursor-pointer">
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? 'Uploading...' : 'Upload File'}
            </label>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filteredEvents.map((e) => {
          const fileUrl = e.properties?.fileUrl;
          const isImage = e.properties?.mimeType?.startsWith('image/');
          
          return (
            <Card key={e.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div 
                className="aspect-square bg-muted flex items-center justify-center relative group cursor-pointer"
                onClick={() => isImage && fileUrl && setSelectedImage(fileUrl)}
              >
                {isImage && fileUrl ? (
                  <img src={fileUrl} alt={e.properties?.fileName} className="w-full h-full object-cover" />
                ) : (
                  getIcon(e.properties?.mimeType)
                )}
                
                {fileUrl && !isImage && (
                  <a 
                    href={fileUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <Download className="h-8 w-8 text-white" />
                  </a>
                )}
              </div>
              <CardContent className="p-3">
                <div className="truncate font-medium text-sm" title={e.properties?.fileName}>
                  {e.properties?.fileName || 'Unnamed File'}
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                  <span>{formatSize(e.properties?.fileSize)}</span>
                  <span>{formatDistanceToNow(new Date(e.timestamp), { addSuffix: true })}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-2 truncate">
                  User ID:{" "}
                  {e.userId || e.anonId ? (
                    <Link
                      to="/users/$userId"
                      params={{ userId: formatUserId(e.anonId || e.id || e.userId) }}
                      className="text-primary hover:underline font-mono"
                    >
                      {formatUserId(e.anonId || e.id || e.userId)}
                    </Link>
                  ) : (
                    "Unknown"
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredEvents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No media uploads found matching your criteria.
        </div>
      )}

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-1 bg-transparent border-none shadow-none">
          {selectedImage && (
            <img 
              src={selectedImage} 
              alt="Preview" 
              className="w-full h-auto max-h-[85vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
