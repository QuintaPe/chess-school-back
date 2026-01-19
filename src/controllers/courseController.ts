import { Request, Response } from 'express';
import * as CourseModel from '../models/courseModel';
import { z } from 'zod';

const courseSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    category: z.string().optional(),
    price: z.number().default(0),
    thumbnail_url: z.string().optional(),
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
        const { level, category, search } = req.query;
        const user = (req as any).user;
        const userId = user?.id;
        const userRole = user?.role;
        const publishedOnly = userRole !== 'admin';

        const courses = await CourseModel.getCourses({
            level: level as string,
            category: category as string,
            publishedOnly,
            search: search as string,
            userId
        });
        return res.json(courses);
    } catch (error) {
        console.error("Error listing courses:", error);
        return res.status(500).json({ message: "Error fetching courses" });
    }
};

export const getCourse = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id as string);
        const userId = (req as any).user?.id;
        const course = await CourseModel.getCourseById(id, userId);
        if (!course) return res.status(404).json({ message: "Course not found" });
        return res.json(course);
    } catch (error) {
        console.error("Error getting course:", error);
        return res.status(500).json({ message: "Error fetching course" });
    }
};

export const listEnrolledCourses = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const courses = await CourseModel.getEnrolledCourses(userId);
        return res.json(courses);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching enrolled courses" });
    }
};

export const createCourse = async (req: Request, res: Response) => {
    try {
        const data = courseSchema.parse(req.body);
        const result = await CourseModel.createCourse(data as any);
        return res.status(201).json({ message: "Course created", id: Number(result.lastInsertRowid) });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data", error });
    }
};

export const addLesson = async (req: Request, res: Response) => {
    try {
        const courseId = parseInt(req.params.id as string);
        const data = lessonSchema.parse(req.body);
        await CourseModel.createLesson({ ...data, course_id: courseId } as any);
        return res.status(201).json({ message: "Lesson added" });
    } catch (error) {
        return res.status(400).json({ message: "Invalid data" });
    }
};

export const updateLessonOrder = async (req: Request, res: Response) => {
    try {
        const lessonId = parseInt(req.params.id as string);
        const { newIndex, oldIndex, courseId } = req.body;
        await CourseModel.updateLessonOrder(lessonId, oldIndex, newIndex, courseId);
        return res.json({ message: "Lesson order updated" });
    } catch (error) {
        return res.status(500).json({ message: "Error updating order" });
    }
};

export const enroll = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const courseId = parseInt(req.params.id as string);
        await CourseModel.enrollUser(userId, courseId);
        return res.json({ message: "Enrolled successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error enrolling" });
    }
};

export const completeLesson = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const lessonId = parseInt(req.params.lessonId as string);
        await CourseModel.completeLesson(userId, lessonId);
        return res.json({ success: true, message: "Lesson marked as completed" });
    } catch (error) {
        return res.status(500).json({ message: "Error completion" });
    }
};

export const uncompleteLesson = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const lessonId = parseInt(req.params.lessonId as string);
        await CourseModel.uncompleteLesson(userId, lessonId);
        return res.json({ success: true, message: "Lesson marked as uncompleted" });
    } catch (error) {
        return res.status(500).json({ message: "Error uncompleting lesson" });
    }
};
