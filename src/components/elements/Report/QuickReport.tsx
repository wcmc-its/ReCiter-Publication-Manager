import Link from "next/link";

const QuickReport = () => {
  return (
    <div>
      <p>To create a report, select one or more filters and click on the "Search" button.</p>
      <br></br>
      <p>You can also click on one of the following:</p>
      <ul>
        <li>
          <Link href=''><a>NewPubs report</a></Link> - publications added to Pubmed in the last month that have been authored by active full-time WCM faculty,
          MD-PhD students, and MD students
        </li>
        <li>
          <Link href=''><a>TrendingPubs report</a></Link> - new publications that have generated the most scholarly interest since their
          publication; includes publications authored by active full-time WCM faculty, MD-PhD students, and MD students
        </li>
      </ul>
    </div>
  )
}

export default QuickReport;