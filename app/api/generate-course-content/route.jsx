import {NextResponse} from "next/server";
import {ai}  from "../generate-course-layout/route";
import axios from "axios";
import { coursesTable } from "@/config/schema";
import { db } from "@/config/db";
import { eq } from "drizzle-orm";


const PROMPT=`Depends on Chapter name and Topic Generate content for each topic in HTML and give response in JSON format.
Schema:{
    chapterName:<>,
    {
    topic:<>,
    content:<>
    }
}

User Input:`


const GetYoutubeVideo1 = async (topic) => {
  const YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3/search";
  const youtubeVideoList = [];

  let nextPageToken = "";
  let done = false;

  while (!done) {
    const params = {
      channelId: 'UCI5p4SKQ5Hh6v9UwMh86s2Q',
      part: 'snippet',
      type: 'video',
      key: process.env.YOUTUBE_API_KEY,
      q: topic,
      maxResults: 50,
      pageToken: nextPageToken
    };

    const resp = await axios.get(YOUTUBE_BASE_URL, { params });
    const items = resp.data.items;

    items.forEach(item => {
      const title = item.snippet?.title?.toLowerCase();
      const videoId = item.id?.videoId;

      if (title && videoId && title.includes(topic.toLowerCase())) {
        youtubeVideoList.push({
          videoId: videoId,
          title: item.snippet?.title
        });
      }
    });

    nextPageToken = resp.data.nextPageToken || null;
    if (!nextPageToken) done = true;
  }

  console.log("youtubeVideoList", youtubeVideoList);
  return youtubeVideoList;
};




const GetYoutubeVideo = async (topic) => {
  const params = {
    part:'snippet',
    type: 'video',
    key: process.env.YOUTUBE_API_KEY,
    q: topic,
    maxResults:4
  };
  const YOUTUBE_BASE_URL = "https://www.googleapis.com/youtube/v3/search";
  const resp = await axios.get(YOUTUBE_BASE_URL, { params });
  const youtubeVideoListResp = resp.data.items;

  const youtubeVideoList = [];
  youtubeVideoListResp.forEach(item => {
    const data = {
      videoId: item.id?.videoId,
      title: item.snippet?.title
    };
    youtubeVideoList.push(data);
  });

  console.log("youtubeVideoList", youtubeVideoList);
  return youtubeVideoList;
};


export async function POST(req){
  const {courseJson,courseTitle,courseId}=await req.json();

  const promises = courseJson?.chapters?.map(async (chapter) => {
  
 const config = {
    responseMimeType: 'text/plain',
  };
  const model = 'gemini-2.0-flash';
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: PROMPT + JSON.stringify(chapter),
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model,
    config,
    contents,
  });

//  console.log(response.candidates[0].content.parts[0].text);
const RawResp = response.candidates[0].content.parts[0].text;
const RawJson = RawResp.replace('```json','').replace('```', '');
const JSONResp = JSON.parse(RawJson);


//Get Youtube Videos
const youtubeData = await GetYoutubeVideo(chapter?.chapterName);
    console.log({
      youtubeVideo: youtubeData,
      courseData: JSONResp
    });
    return {
      youtubeVideo: youtubeData,
      courseData: JSONResp
    };
  });

  const CourseContent = await Promise.all(promises);

  //save to DB
  const dbResp = await db.update(coursesTable).set({
    courseContent: CourseContent
  }).where(eq(coursesTable.cid, courseId));

  return NextResponse.json({
    courseName: courseTitle,
    CourseContent: CourseContent
  });
}


