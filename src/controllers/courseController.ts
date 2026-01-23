import { Request, Response } from 'express';
import { z } from 'zod';
import { logActivity } from '../models/audit/activityLogModel';
import * as UserModel from '../models/auth/userModel';
import * as CoursesModel from '../models/courses/coursesModel';
import * as ModulesModel from '../models/courses/modulesModel';
import * as LessonsModel from '../models/courses/lessonsModel';
import * as UserProgressModel from '../models/courses/userProgressModel';
import * as UserEntitlementsModel from '../models/billing/userEntitlementsModel';

const courseSchema = z.object({
    title: z.string(),
    slug: z.string(),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    is_published: z.boolean().default(false),
});

const lessonSchema = z.object({
    title: z.string(),
    content: z.string().optional(),
    video_url: z.string().optional(),
    order_index: z.number(),
});

export const listAllCourses = async (req: Request, res: Response) => {
    try {
        const { level, search } = req.query;
        const user = (req as any).user;
        const userRole = user?.role;
        const publishedOnly = userRole !== 'admin';

        const courses = await CoursesModel.listCourses({
            level: level as string,
            publishedOnly,
            search: search as string
        });
        return res.json(courses);
    } catch (error) {
        console.error("Error listing courses:", error);
        return res.status(500).json({ message: "Error fetching courses" });
    }
};

export const getCourse = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const userId = (req as any).user?.id;
        const course = await CoursesModel.getCourseById(id);
        if (!course) return res.status(404).json({ message: "Course not found" });

        const modules = await ModulesModel.listModulesByCourse(id);
        const lessons = await LessonsModel.listLessonsByCourse(id);

        const progressRows = userId ? await UserProgressModel.listUserProgressByCourse(userId, id) : [];
        const completedLessonIds = new Set(progressRows.filter((p: any) => p.status === 'completed').map((p: any) => p.lesson_id));

        const lessonsWithProgress = lessons.map((l: any) => ({
            ...l,
            is_completed: completedLessonIds.has(l.id)
        }));

        const total_lessons = lessonsWithProgress.length;
        const completed_lessons = lessonsWithProgress.filter((l: any) => l.is_completed).length;

        const modulesWithLessons = modules.map((m: any) => ({
            ...m,
            lessons: lessonsWithProgress.filter((l: any) => l.module_id === m.id)
        }));

        return res.json({
            ...course,
            modules: modulesWithLessons,
            total_lessons,
            completed_lessons,
            progress_percentage: total_lessons > 0 ? Math.round((completed_lessons / total_lessons) * 100) : 0
        });
    } catch (error) {
        console.error("Error getting course:", error);
        return res.status(500).json({ message: "Error fetching course" });
    }
};

export const listEnrolledCourses = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const courses = await UserEntitlementsModel.listEntitledCourses(userId);
        return res.json(courses);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching enrolled courses" });
    }
};

export const createCourse = async (req: Request, res: Response) => {
    try {
        const data = courseSchema.parse(req.body);

        const existingBySlug = await CoursesModel.getCourseBySlug(data.slug);
        if (existingBySlug) {
            return res.status(409).json({ message: "Slug already exists" });
        }

        const result = await CoursesModel.createCourse(data as any);

        await logActivity('course_created', `Nuevo curso publicado: ${data.title}`);

        return res.status(201).json({ message: "Course created", id: result.lastInsertRowid });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const updateCourse = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const updates = req.body;
        await CoursesModel.updateCourse(id, updates);
        return res.json({ message: "Course updated" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating course" });
    }
};

export const deleteCourse = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await CoursesModel.deleteCourse(id);
        return res.json({ message: "Course deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting course" });
    }
};

export const addModule = async (req: Request, res: Response) => {
    try {
        const courseId = req.params.id as string;
        const { title, order_index } = req.body;
        await ModulesModel.createModule({
            course_id: courseId,
            title,
            order_index: order_index || 0
        });
        return res.status(201).json({ message: "Module added" });
    } catch (error) {
        return res.status(500).json({ message: "Error adding module" });
    }
};

export const updateModule = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.moduleId);
        const updates = req.body;
        await ModulesModel.updateModule(id, updates);
        return res.json({ message: "Module updated" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating module" });
    }
};

export const deleteModule = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.moduleId);
        await ModulesModel.deleteModule(id);
        return res.json({ message: "Module deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting module" });
    }
};

export const addLesson = async (req: Request, res: Response) => {
    try {
        const courseId = req.params.id as string;
        const data = lessonSchema.parse(req.body);
        const { module_id } = req.body;

        let effectiveModuleId = module_id;
        if (!effectiveModuleId) {
            effectiveModuleId = await ModulesModel.getFirstModuleIdForCourse(courseId);
            if (!effectiveModuleId) {
                const moduleRes = await ModulesModel.createModule({
                    course_id: courseId,
                    title: 'Módulo 1',
                    order_index: 0
                });
                effectiveModuleId = moduleRes.lastInsertRowid as string;
            }
        }

        await LessonsModel.createLesson({
            module_id: effectiveModuleId,
            title: data.title,
            lesson_type: data.video_url ? 'video' : 'article',
            content_md: data.content ?? null,
            video_url: data.video_url ?? null,
            order_index: data.order_index
        } as any);
        return res.status(201).json({ message: "Lesson added" });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data" });
    }
};

export const updateLessonOrder = async (req: Request, res: Response) => {
    try {
        const lessonId = req.params.id as string;
        const { newIndex, oldIndex, moduleId } = req.body;

        let effectiveModuleId = moduleId as string | undefined;
        if (!effectiveModuleId) {
            const lesson = await LessonsModel.getLessonById(lessonId);
            effectiveModuleId = (lesson as any)?.module_id;
        }
        if (!effectiveModuleId) {
            return res.status(400).json({ message: "Invalid data" });
        }

        await LessonsModel.updateLessonOrder(lessonId, oldIndex, newIndex, effectiveModuleId);
        return res.json({ message: "Lesson order updated" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating order" });
    }
};

export const updateLesson = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        const updates = req.body;
        await LessonsModel.updateLesson(id, updates);
        return res.json({ message: "Lesson updated" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating lesson" });
    }
};

export const deleteLesson = async (req: Request, res: Response) => {
    try {
        const id = String(req.params.id);
        await LessonsModel.deleteLesson(id);
        return res.json({ message: "Lesson deleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting lesson" });
    }
};

export const enroll = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const courseId = req.params.id as string;
        await UserEntitlementsModel.grantCourseLifetimeEntitlement(userId, courseId);

        // Log activity
        const user = await UserModel.findUserById(userId);
        const course = await CoursesModel.getCourseById(courseId) as any;
        if (user && course) {
            await logActivity('course_purchased', `El alumno ${(user as any).name} se ha inscrito al curso: ${course.title}`);
        }

        return res.json({ message: "Enrolled successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error enrolling" });
    }
};

export const completeLesson = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const lessonId = req.params.lessonId as string;
        await UserProgressModel.markLessonCompleted(userId, lessonId);
        return res.json({ success: true, message: "Lesson marked as completed" });
    } catch (error) {
        return res.status(500).json({ message: "Error completion" });
    }
};

export const uncompleteLesson = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const lessonId = req.params.lessonId as string;
        await UserProgressModel.uncompleteLesson(userId, lessonId);
        return res.json({ success: true, message: "Lesson marked as uncompleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error uncompleting lesson" });
    }
};
