import sys, os
sys.path.insert(0, ".")
import notion_qa

card_id_1 = "409f9ffd-2c1d-807f-8822-eb96b6289d8f" # 고치기 파일 바로 띄우기
card_id_2 = "408f9ffd-2c1d-817f-bfc7-f814a9f77a7f" # 고치기 전수 점검

feedback_text = (
    "✅ [수정 완료 안내 - 제트코어 v2.3.2 업데이트]\n\n"
    "1. 폴더 경로에 괄호나 띄어쓰기가 있는 경우(예: 'Downloads\\Merlin_Z_Core (4)\\안내_README.txt') 탐색기 명령어가 잘못 인식되어 문서 폴더가 열리거나 파란색 강조가 풀리던 현상을 완벽하게 수정했습니다.\n"
    "2. 이제 '🔍 탐색기 검색창에 파일명 넣어 이 파일만 바로 띄우기' 버튼을 누르면 해당 파일이 위치한 실제 폴더가 열리며 파란색으로 선택 강조(선택 상태)되어 최상단으로 깔끔하게 표시됩니다.\n"
    "3. 제트코어가 v2.3.2로 새롭게 업데이트되었으니, 기존에 실행 중이던 제트코어를 우측 하단 트레이 아이콘에서 마우스 우클릭 -> [종료]하신 뒤 최신 파일로 다시 실행하여 확인 부탁드립니다!"
)

print("1. Inserting inline feedback into card 1...")
res1 = notion_qa.insert_inline_ai_feedback(card_id_1, feedback_text)
print(f"Result 1: {res1}")

print("2. Moving card 1 to 재테스트 대기...")
notion_qa.update_bug_status(card_id_1, "재테스트 대기")

print("3. Moving card 2 to 재테스트 대기...")
notion_qa.update_bug_status(card_id_2, "재테스트 대기")

print("Done updating cards!")
