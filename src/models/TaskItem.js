import mongoose from 'mongoose';

const taskItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Give your task a title.'], trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    category: {
      type: String,
      enum: { values: ['School', 'Work', 'Personal'], message: 'Pick School, Work or Personal.' },
      required: true,
      default: 'School',
    },
    hours: { type: Number, required: [true, 'Add how many hours it will take.'], min: 0.5, max: 12, default: 1 },

    // Where the task lives: floating (this week's pile), checklist (repeats every week),
    // or scheduled (placed on a day + time slot).
    list: { type: String, enum: ['floating', 'checklist', 'scheduled'], default: 'floating' },
    weekStart: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }, // Sunday of the week, e.g. 2026-11-22
    day: { type: Number, min: 0, max: 6 }, // 0 = Sunday
    startHour: { type: Number, min: 0, max: 23.5 }, // 13.5 = 1:30 PM

    // Scheduled tasks can repeat at the same time: every day or every week, starting from weekStart.
    repeat: { type: String, enum: ['none', 'daily', 'weekly'], default: 'none' },

    // Checklist tasks: Sunday of the week this was last checked off. It counts as done only
    // while that equals the current week, so checkmarks reset themselves every Sunday.
    completedWeek: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true }
);

// Third argument pins the collection name to "task_items".
export default mongoose.models.TaskItem || mongoose.model('TaskItem', taskItemSchema, 'task_items');
