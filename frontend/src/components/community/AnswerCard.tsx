import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import RoleBadge from "./RoleBadge";

interface AnswerCardProps {
  answer: {
    id: string;
    body: string;
    is_best_answer: boolean;
    upvote_count: number;
    created_at: string;
    author_name?: string;
    author_role?: string;
  };
  isPostOwner: boolean;
  isAnswerOwner?: boolean;
  onMarkBest?: (answerId: string) => void;
  onDelete?: (answerId: string) => void;
  onSaveEdit?: (answerId: string, newBody: string) => void;
}

export default function AnswerCard({ answer, isPostOwner, isAnswerOwner, onMarkBest, onDelete, onSaveEdit }: AnswerCardProps) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(answer.body);

  const handleSave = () => {
    if (!editBody.trim() || !onSaveEdit) return;
    onSaveEdit(answer.id, editBody);
    setEditing(false);
  };

  return (
    <Card className={`transition-all ${answer.is_best_answer ? "border-2" : ""}`} style={answer.is_best_answer ? { borderColor: "#14B8A6" } : undefined}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold" style={{ color: "#14B8A6" }}>
            {(answer.author_name || "U").charAt(0)}
          </div>
          <span className="text-sm font-medium">{answer.author_name || "User"}</span>
          {answer.author_role && <RoleBadge role={answer.author_role} />}
          {answer.is_best_answer && (
            <Badge className="text-[10px] h-5 gap-1" style={{ backgroundColor: "#14B8A61A", color: "#14B8A6" }}>
              <CheckCircle2 className="h-3 w-3" /> Best Answer
            </Badge>
          )}
          {isAnswerOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto"><MoreVertical className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setEditBody(answer.body); setEditing(true); }}>
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this answer?</AlertDialogTitle>
                      <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete?.(answer.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={3} maxLength={3000} />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!editBody.trim()} style={{ backgroundColor: "#14B8A6" }} className="text-white">Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap">{answer.body}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            {new Date(answer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          {isPostOwner && !answer.is_best_answer && onMarkBest && (
            <button onClick={() => onMarkBest(answer.id)} className="text-xs font-medium hover:underline" style={{ color: "#14B8A6" }}>
              Mark as Best Answer
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
