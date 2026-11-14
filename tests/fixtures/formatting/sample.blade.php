<?php $serverText = "{'server
text'}"; ?>
<section g-scope="Page">
    {{ "{'server
    text'}" }}
    {!! "{'server
    text'}" !!}
    <p>{ready ? 'Your changes were saved
    and you may continue editing.' : 'Waiting'}</p>
    <div g-ignore>{ready ? 'Ignored
    content' : 'Waiting'}</div>
</section>
