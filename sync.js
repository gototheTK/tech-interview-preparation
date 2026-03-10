const { Client } = require("@notionhq/client");
const { NotionToMarkdown } = require("notion-to-md");
const fs = require("fs");
const path = require("path");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const n2m = new NotionToMarkdown({ notionClient: notion });

(async () => {
  try {
    const dbId = process.env.NOTION_DATABASE_ID;
    console.log("🔎 데이터베이스 조회를 시작합니다. ID:", dbId);
    
    const response = await notion.databases.query({ database_id: dbId });
    console.log(`📦 총 ${response.results.length}개의 페이지를 찾았습니다.`);

    const dir = path.join(process.cwd(), "docs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    // 💡 [추가됨] README에 넣을 목차 리스트를 담을 빈 배열
    const indexList = [];

    for (const page of response.results) {
      let title = page.id; 
      for (const key in page.properties) {
        if (page.properties[key].type === "title") {
          title = page.properties[key].title[0]?.plain_text || page.id;
          break;
        }
      }
      const safeTitle = title.replace(/[\/\\?%*:|"<>]/g, '-');
      
      try {
        console.log(`✍️ 마크다운 변환 중: ${safeTitle}`);
        const mdblocks = await n2m.pageToMarkdown(page.id);
        const mdString = n2m.toMarkdownString(mdblocks);
        
        let content = "";
        if (typeof mdString === "string") {
          content = mdString;
        } else if (typeof mdString === "object" && mdString !== null) {
          content = mdString.parent || "";
        }
        
        fs.writeFileSync(path.join(dir, `${safeTitle}.md`), content);
        console.log(`✅ 저장 완료: docs/${safeTitle}.md`);

        // 💡 [추가됨] 저장에 성공한 파일만 목차 배열에 추가 (띄어쓰기/한글 파일명 링크 에러 방지를 위해 URI 인코딩)
        const encodedTitle = encodeURIComponent(`${safeTitle}.md`);
        indexList.push(`- [${safeTitle}](./docs/${encodedTitle})`);

      } catch (pageError) {
        console.error(`⚠️ [${safeTitle}] 노션 서버 장애로 건너뜁니다:`, pageError.message);
      }
    }

    // 💡 [추가됨] README.md 자동 생성 로직
    console.log("📝 README.md 목차 생성을 시작합니다...");
    const readmeContent = `# Tech Interview Preparation Q&A \n ## 📚 최근 학습 목록 \n ${indexList.length > 0 ? indexList.join('\n') : '- 아직 작성된 문서가 없습니다.'} 
    --- 
    \n *최종 업데이트: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}*`;
    
    fs.writeFileSync(path.join(process.cwd(), "README.md"), readmeContent);
    console.log("✅ README.md 업데이트 완료!");

    console.log("🎉 모든 작업이 끝났습니다!");
    
  } catch (error) {
    console.error("❌ 치명적인 에러가 발생했습니다:", error);
    process.exit(1); 
  }
})();
